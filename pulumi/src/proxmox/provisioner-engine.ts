import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as ansible from '@pulumi/ansible';
import * as fs from 'fs';
import * as path from 'path';
import {
  Provisioner,
  ScriptProvisioner,
  AnsibleProvisioner,
} from './host-config-parser';
import { EnvUtils } from '../utils/env-utils';

export type ProvisionerResource = command.remote.Command | ansible.Playbook;

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
  ): ProvisionerResource[] {
    const resources: ProvisionerResource[] = [];

    let previousCommand: ProvisionerResource | undefined;

    for (let i = 0; i < provisioners.length; i++) {
      const provisioner = provisioners[i];
      const cmd = this.createProvisionerCommand(
        provisioner,
        parent,
        previousCommand,
        i,
      );
      resources.push(cmd);
      previousCommand = cmd;
    }

    return resources;
  }

  private createProvisionerCommand(
    provisioner: Provisioner,
    parent: pulumi.Resource,
    dependsOn?: ProvisionerResource,
    index?: number,
  ): ProvisionerResource {
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
        return this.createAnsiblePlaybook(
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
    dependsOn?: ProvisionerResource,
  ): command.remote.Command {
    const scriptPath = path.resolve(this.args.projectRoot, provisioner.script);

    // Validate script path exists and is within project
    this.validateScriptPath(scriptPath, provisioner.script);

    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    const executeScript = ProvisionerEngine.buildExecutionCommands(
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

  private static buildExecutionCommands(
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

  private createAnsiblePlaybook(
    provisioner: AnsibleProvisioner,
    commandName: string,
    connection: command.types.input.remote.ConnectionArgs,
    parent: pulumi.Resource,
    dependsOn?: ProvisionerResource,
  ): ansible.Playbook {
    const playbookPath = path.resolve(
      this.args.projectRoot,
      provisioner.playbook,
    );

    this.validatePlaybookPath(playbookPath, provisioner.playbook);

    // Check for requirements file and install collections if needed
    const requirementsCommand = this.createRequirementsInstallCommand(
      provisioner,
      commandName,
      parent,
      dependsOn,
    );

    const playbook = new ansible.Playbook(
      commandName,
      {
        playbook: playbookPath,
        name: provisioner.name,
        replayable: provisioner.replayable,
        ...(provisioner.tags && { tags: provisioner.tags }),
        ...(provisioner.limit && { limits: [provisioner.limit] }),
        timeouts: {
          create: `${provisioner.timeout}s`,
        },
        extraVars: {
          // https://docs.ansible.com/ansible/latest/reference_appendices/special_variables.html#connection-variables
          ansible_host: connection.host,
          ansible_user: provisioner.user,
          // https://docs.ansible.com/ansible/2.9/plugins/connection/ssh.html#ssh-connection
          ansible_ssh_private_key_file: provisioner.privateKeyFile,
          ansible_ssh_host_key_checking: 'false',
          ansible_ssh_retries: '3',
          // disable warning due to ansible automatically choosing the python version on the target
          ansible_python_interpreter: 'auto_silent',
          ...(provisioner.variables
            ? Object.entries(provisioner.variables).reduce((acc, [k, v]) => {
                acc[k] = String(v);
                return acc;
              }, {} as Record<string, string>)
            : {}),
        },
      },
      {
        parent,
        ...(requirementsCommand
          ? { dependsOn: requirementsCommand }
          : dependsOn && { dependsOn }),
        additionalSecretOutputs: [
          'ansiblePlaybookStdout',
          'ansiblePlaybookStderr',
        ],
      },
    );

    return playbook;
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

  /**
   * Creates a local command to install Ansible requirements if a requirements file exists
   * for the given playbook. The requirements file should be named <playbookname>.requirements.yaml
   */
  private createRequirementsInstallCommand(
    provisioner: AnsibleProvisioner,
    commandName: string,
    parent: pulumi.Resource,
    dependsOn?: ProvisionerResource,
  ): command.local.Command | null {
    const playbookPath = path.resolve(
      this.args.projectRoot,
      provisioner.playbook,
    );
    const playbookDir = path.dirname(playbookPath);
    const playbookName = path.basename(
      playbookPath,
      path.extname(playbookPath),
    );
    const requirementsPath = path.join(
      playbookDir,
      `${playbookName}.requirements.yaml`,
    );

    if (!fs.existsSync(requirementsPath)) {
      return null;
    }

    const requirementsCommandName = `${commandName}-requirements`;

    return new command.local.Command(
      requirementsCommandName,
      {
        create: `ansible-galaxy collection install -r "${requirementsPath}"`,
        environment: {
          ANSIBLE_COLLECTIONS_PATH:
            process.env.ANSIBLE_COLLECTIONS_PATH || '~/.ansible/collections',
        },
      },
      {
        parent,
        ...(dependsOn && { dependsOn }),
      },
    );
  }

  private validatePlaybookPath(
    absolutePath: string,
    relativePath: string,
  ): void {
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Provisioner playbook not found: ${relativePath}`);
    }

    const normalizedProjectRoot = path.normalize(this.args.projectRoot);
    const normalizedPlaybookPath = path.normalize(absolutePath);

    if (!normalizedPlaybookPath.startsWith(normalizedProjectRoot)) {
      throw new Error(
        `Provisioner playbook path outside project directory: ${relativePath}`,
      );
    }
  }
}
