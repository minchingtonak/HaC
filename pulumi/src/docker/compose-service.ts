import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import path = require('node:path');

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

    this.deployService = new command.remote.Command(
      `deploy-${args.serviceName}-service`,
      {
        create: `cd ${remoteServiceDirectory} && docker compose up -d`,
        delete: `cd ${remoteServiceDirectory} && docker compose down`,
        // TODO
        environment: {},
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
        deleteBeforeReplace: true
      },
    );

    this.registerOutputs();
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
