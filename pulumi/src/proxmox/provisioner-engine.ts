import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as fs from 'fs';
import * as path from 'path';
import {
  Provisioner,
  ScriptProvisioner,
  AnsibleProvisioner,
} from './host-config-parser';
import { EnvUtils } from '../utils/env-utils';

export interface ProvisionerEngineArgs {
  connection: command.types.input.remote.ConnectionArgs;
  projectRoot: string;
  hostname: string;
}

export class ProvisionerEngine {
  constructor(private args: ProvisionerEngineArgs) {}

  /**
   * Execute provisioners in declaration order (array order from TOML)
   */
  executeProvisioners(
    provisioners: Provisioner[],
    parent: pulumi.Resource,
  ): command.remote.Command[] {
    const commands: command.remote.Command[] = [];

    let previousCommand: command.remote.Command | undefined;

    for (let i = 0; i < provisioners.length; i++) {
      const provisioner = provisioners[i];
      const cmd = this.createProvisionerCommand(
        provisioner,
        parent,
        previousCommand,
        i,
      );
      commands.push(cmd);
      previousCommand = cmd;
    }

    return commands;
  }

  private createProvisionerCommand(
    provisioner: Provisioner,
    parent: pulumi.Resource,
    dependsOn?: command.remote.Command,
    index?: number,
  ): command.remote.Command {
    const connection = this.buildConnection(provisioner);
    const commandName = `${this.args.hostname}-provisioner-${index}-${provisioner.name}`;

    switch (provisioner.type) {
      case 'script':
        return this.createScriptCommand(
          provisioner,
          commandName,
          connection,
          parent,
          dependsOn,
        );
      case 'ansible':
        // FIXME needs testing/rework
        return this.createAnsibleCommand(
          provisioner,
          commandName,
          connection,
          parent,
          dependsOn,
        );
    }
  }

  private buildConnection(
    provisioner: Provisioner,
  ): command.types.input.remote.ConnectionArgs {
    const baseConnection = this.args.connection;
    const override = provisioner.connection;

    if (!override) return baseConnection;

    return {
      ...baseConnection,
      ...(override.host && { host: override.host }),
      ...(override.user && { user: override.user }),
      ...(override.port && { port: override.port }),
      ...(override.privateKey && { privateKey: override.privateKey }),
    };
  }

  private createScriptCommand(
    provisioner: ScriptProvisioner,
    commandName: string,
    connection: command.types.input.remote.ConnectionArgs,
    parent: pulumi.Resource,
    dependsOn?: command.remote.Command,
  ): command.remote.Command {
    const scriptPath = path.resolve(this.args.projectRoot, provisioner.script);

    // Validate script path exists and is within project
    this.validateScriptPath(scriptPath, provisioner.script);

    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    const executeScript = this.buildExecutionCommands(
      provisioner,
      scriptContent,
    );

    const env = provisioner.environment
      ? EnvUtils.stringifyEnvForScript(provisioner.environment)
      : '';

    const commandString = pulumi.secret(
      pulumi.interpolate`${env}\n${executeScript}`,
    );

    return new command.remote.Command(
      commandName,
      {
        ...provisioner.runOn.reduce((acc, curr) => {
          acc[curr] = commandString;
          return acc;
        }, {} as command.remote.CommandArgs),
        connection,
      },
      {
        parent,
        ...(dependsOn && { dependsOn }),
        additionalSecretOutputs: ['stdout', 'stderr'],
      },
    );
  }

  private buildExecutionCommands(
    provisioner: ScriptProvisioner,
    scriptContent: string,
  ): string {
    const scriptName = path.basename(provisioner.script);

    const remoteScriptDir = path.join(
      provisioner.workingDirectory,
      'pulumi',
      provisioner.name,
    );

    const remoteScriptPath = path.join(remoteScriptDir, scriptName);

    const commands = [
      `cd ${provisioner.workingDirectory}`,
      `echo "=== Script Provisioner: ${provisioner.name} ==="`,
      `echo "Working directory: $(pwd)"`,
      `echo "Running as: ${provisioner.runAs}"`,
      `echo "=== Script Content ==="`,
      `mkdir -p ${remoteScriptDir}`,
      `cat > ${remoteScriptPath} << 'EOF'`,
      scriptContent,
      'EOF',
      `chmod +x ${remoteScriptPath}`,
      `echo "=== Execution Start ==="`,
      `# Check if we need to switch users`,
      `CURRENT_USER=$(whoami)`,
      `TARGET_USER="${provisioner.runAs}"`,
      `if [ "$CURRENT_USER" = "$TARGET_USER" ]; then`,
      `  # Already running as target user, execute directly`,
      `  EXEC_CMD="${remoteScriptPath}"`,
      `elif command -v runuser >/dev/null 2>&1; then`,
      `  # Use runuser if available (preferred over su)`,
      `  EXEC_CMD="runuser -u $TARGET_USER -- ${remoteScriptPath}"`,
      `elif command -v su >/dev/null 2>&1; then`,
      `  # Fallback to su if runuser not available`,
      `  EXEC_CMD="su -c '${remoteScriptPath}' $TARGET_USER"`,
      `else`,
      `  echo "=== Warning: No user switching mechanism available (sudo, runuser, su) ==="`,
      `  echo "=== Executing as current user: $CURRENT_USER ==="`,
      `  EXEC_CMD="${remoteScriptPath}"`,
      `fi`,
      ``,
      `if eval "$EXEC_CMD"; then`,
      `  echo "=== Execution Success ==="`,
      `else`,
      `  EXIT_CODE=$?`,
      `  echo "=== Execution Failed (Exit Code: $EXIT_CODE) ==="`,
      `  echo "Script: ${provisioner.script}"`,
      `  echo "Remote Script: ${remoteScriptPath}"`,
      `  echo "Provisioner: ${provisioner.name}"`,
      `  echo "Current User: $CURRENT_USER"`,
      `  echo "Target User: $TARGET_USER"`,
      `  echo "Execution Command: $EXEC_CMD"`,
      `  rm -rf ${remoteScriptDir}`,
      `  exit $EXIT_CODE`,
      `fi`,
      `rm -rf ${remoteScriptDir}`,
      `echo "=== Provisioner Complete ==="`,
    ];

    return commands.join('\n');
  }

  private createAnsibleCommand(
    provisioner: AnsibleProvisioner,
    commandName: string,
    connection: command.types.input.remote.ConnectionArgs,
    parent: pulumi.Resource,
    dependsOn?: command.remote.Command,
  ): command.remote.Command {
    const playbookPath = path.resolve(
      this.args.projectRoot,
      'provisioners/ansible',
      provisioner.playbook,
    );

    // Validate playbook path exists
    this.validatePlaybookPath(playbookPath, provisioner.playbook);

    // Build ansible-playbook command
    let ansibleCmd = `ansible-playbook ${playbookPath} -i "${connection.host},"`;

    if (provisioner.variables) {
      const extraVars = Object.entries(provisioner.variables)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      ansibleCmd += ` --extra-vars "${extraVars}"`;
    }

    if (provisioner.tags) {
      ansibleCmd += ` --tags "${provisioner.tags.join(',')}"`;
    }

    if (provisioner.limit) {
      ansibleCmd += ` --limit "${provisioner.limit}"`;
    }

    // Run ansible-playbook from the remote host
    const runAnsible = [
      `cd /tmp`,
      `export ANSIBLE_HOST_KEY_CHECKING=False`,
      `export ANSIBLE_SSH_PRIVATE_KEY_FILE=/tmp/ansible_key`,
      `export ANSIBLE_REMOTE_USER=${connection.user}`,
      `cat > /tmp/ansible_key << 'EOF'`,
      connection.privateKey as string,
      'EOF',
      `chmod 600 /tmp/ansible_key`,
      ansibleCmd,
      `rm -f /tmp/ansible_key`,
    ].join('\n');

    return new command.remote.Command(
      commandName,
      {
        create: runAnsible,
        connection,
      },
      {
        parent,
        ...(dependsOn && { dependsOn }),
      },
    );
  }

  private validateScriptPath(absolutePath: string, relativePath: string): void {
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Provisioner script not found: ${relativePath}`);
    }

    const normalizedProjectRoot = path.normalize(this.args.projectRoot);
    const normalizedScriptPath = path.normalize(absolutePath);

    if (!normalizedScriptPath.startsWith(normalizedProjectRoot)) {
      throw new Error(
        `Provisioner script path outside project directory: ${relativePath}`,
      );
    }
  }

  private validatePlaybookPath(
    absolutePath: string,
    relativePath: string,
  ): void {
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `Provisioner playbook not found: provisioners/ansible/${relativePath}`,
      );
    }

    // Security check: ensure path is within provisioners directory
    const normalizedProvisionersDir = path.normalize(
      path.join(this.args.projectRoot, 'provisioners'),
    );
    const normalizedPlaybookPath = path.normalize(absolutePath);

    if (!normalizedPlaybookPath.startsWith(normalizedProvisionersDir)) {
      throw new Error(
        `Provisioner playbook path outside provisioners directory: ${relativePath}`,
      );
    }
  }
}
