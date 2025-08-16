import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as path from 'node:path';
import * as fs from 'node:fs';

export type ServiceName = string;

export type ComposeServiceArgs = {
  serviceName: ServiceName;
  connection: command.types.input.remote.ConnectionArgs;
};

export class ComposeService extends pulumi.ComponentResource {
  serviceDirectory: pulumi.asset.FileAsset;

  copyServiceToRemote: command.remote.CopyToRemote;

  deployService: command.remote.Command;

  constructor(
    name: string,
    args: ComposeServiceArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('HaC:docker:ComposeService', name, {}, opts);

    this.serviceDirectory = new pulumi.asset.FileArchive(
      `./services/${args.serviceName}`,
    );

    const remoteServiceDirectoryBase = `/etc/pulumi`;
    const remoteServiceDirectory = path.join(
      remoteServiceDirectoryBase,
      args.serviceName,
    );

    this.copyServiceToRemote = new command.remote.CopyToRemote(
      `copy-${args.serviceName}-service-directory`,
      {
        source: this.serviceDirectory,
        remotePath: remoteServiceDirectoryBase,
        connection: args.connection,
      },
      {
        parent: this,
      },
    );

    const serviceEnv = ComposeService.assembleVariableMap(args.serviceName);

    const stringifiedEnv = pulumi
      .all(
        Object.entries(serviceEnv).map(
          ([name, value]) =>
            // process the env vars before the apply() call to avoid exposing secrets in resource outputs
            pulumi.interpolate`${name}="${ComposeService.escapeBashEnvValue(
              value,
            )}"`,
        ),
      )
      .apply((envArray) => envArray.join(' '));

    this.deployService = new command.remote.Command(
      `deploy-${args.serviceName}-service`,
      {
        create: pulumi.interpolate`cd ${remoteServiceDirectory} && ${stringifiedEnv} docker compose up -d --force-recreate`,
        delete: pulumi.interpolate`cd ${remoteServiceDirectory} && ${stringifiedEnv} docker compose down`,
        addPreviousOutputInEnv: false,
        triggers: [this.serviceDirectory],
        connection: args.connection,
      },
      {
        parent: this,
        dependsOn: this.copyServiceToRemote,
        hooks: {
          afterCreate: [this.checkForMissingVariables.bind(this)],
          afterUpdate: [this.checkForMissingVariables.bind(this)],
        },
        deleteBeforeReplace: true,
      },
    );

    this.registerOutputs({
      deployCommand: this.deployService.create,
      destroyCommand: this.deployService.delete,
      deployCommandStdout: this.deployService.stdout,
      deployCommandStderr: this.deployService.stderr,
    });
  }

  private static SECRET_VARIABLE_PREFIX = 'SECRET';

  private static assembleVariableMap(serviceName: string) {
    const serviceConfig = new pulumi.Config(serviceName);
    const fileContent = fs.readFileSync(
      `./services/${serviceName}/compose.yaml`,
      { encoding: 'utf-8' },
    );

    const varPattern = /\$\{(?<varName>[^}]+)\}/g;
    const matches = fileContent.matchAll(varPattern);

    const serviceEnv: Record<string, string | pulumi.Output<string>> = {};

    for (const match of matches) {
      if (!match.groups) {
        continue;
      }

      const varName = match.groups.varName;
      if (varName.startsWith(ComposeService.SECRET_VARIABLE_PREFIX)) {
        serviceEnv[varName] = serviceConfig.requireSecret(varName);
      } else {
        serviceEnv[varName] = serviceConfig.require(varName);
      }
    }

    return serviceEnv;
  }

  private static escapeBashEnvValue(
    value: string | pulumi.Output<string>,
    allowVariableExpansion: boolean = false,
  ) {
    function replacer(value: string) {
      let result = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

      if (!allowVariableExpansion) {
        result = result.replaceAll('$', '\\$');
      }

      const res = result.replaceAll('`', '\\`').replaceAll('!', '\\!');
      pulumi.log.info(`Replaced '${value}' with '${res}'`);
      return res;
    }

    if (pulumi.Output.isInstance(value)) {
      return value.apply(replacer);
    }

    return replacer(value);
  }

  private static UNSET_VARIABLE_MARKER = 'variable is not set';

  private checkForMissingVariables(args: pulumi.ResourceHookArgs) {
    const outputs = args.newOutputs as {
      stderr: string;
    };

    const missingVars = outputs.stderr
      .split('\n')
      .filter((line) => line.includes(ComposeService.UNSET_VARIABLE_MARKER));

    if (missingVars.length) {
      throw new Error('\n' + missingVars.join('\n'));
    }
  }
}
