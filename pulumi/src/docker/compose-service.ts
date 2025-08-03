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

    // FIXME either figure out a way to stringify the env var secret values
    // or try using a playbook to deploy the service (may be better long term)
    const stringifiedEnv = Object.entries(serviceEnv)
      .map(([name, value]) => pulumi.interpolate`${name}=${value}`)
      .join(' ');

    this.deployService = new command.remote.Command(
      `deploy-${args.serviceName}-service`,
      {
        create: `cd ${remoteServiceDirectory} && ${stringifiedEnv} docker compose up -d`,
        delete: `cd ${remoteServiceDirectory} && ${stringifiedEnv} docker compose down`,
        // environment: serviceEnv,
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

    this.registerOutputs();
  }

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
      if (varName.startsWith('SECRET')) {
        serviceEnv[varName] = serviceConfig.requireSecret(varName);
      } else {
        serviceEnv[varName] = serviceConfig.require(varName);
      }
    }

    return serviceEnv;
  }

  private checkForMissingVariables(args: pulumi.ResourceHookArgs) {
    const outputs = args.newOutputs as {
      stderr: string;
    };

    const missingVars = outputs.stderr
      .split('\n')
      .filter((line) => line.includes('variable is not set'));

    if (missingVars.length) {
      throw new Error('\n' + missingVars.join('\n'));
    }
  }
}
