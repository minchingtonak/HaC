import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as path from 'node:path';
import { HandlebarsTemplateDirectory } from '../templates/handlebars-template-directory';
import { ComposeFileUtils } from './compose-file-processor';
import { HostConfigToml } from '../hosts/host-config-schema';

export type ServiceName = string;

export type ComposeStackArgs = {
  serviceName: ServiceName;
  connection: command.types.input.remote.ConnectionArgs;
  hostConfig: HostConfigToml;
};

export class ComposeStack extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = 'HaC:docker:ComposeStack';

  serviceDirectory: pulumi.asset.FileAsset;

  copyServiceToRemote: command.remote.CopyToRemote;

  handlebarsTemplateDirectory: HandlebarsTemplateDirectory;

  processedTemplateCopies: {
    [templatePath: string]: command.remote.CopyToRemote;
  } = {};

  deployService: command.remote.Command;

  constructor(
    name: string,
    args: ComposeStackArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(ComposeStack.RESOURCE_TYPE, name, {}, opts);

    const serviceDir = ComposeFileUtils.SERVICE_DIRECTORY_FOR(
      args.serviceName,
    );

    this.serviceDirectory = new pulumi.asset.FileArchive(serviceDir);

    const remoteServiceDirectoryBase = '/etc/pulumi'; // TODO make configurable?
    const remoteServiceDirectory = path.join(
      remoteServiceDirectoryBase,
      args.serviceName,
    );

    this.copyServiceToRemote = new command.remote.CopyToRemote(
      `${args.hostConfig.hostname}-copy-${args.serviceName}-service-directory`,
      {
        source: this.serviceDirectory,
        remotePath: remoteServiceDirectoryBase,
        connection: args.connection,
      },
      {
        parent: this,
      },
    );

    this.handlebarsTemplateDirectory = new HandlebarsTemplateDirectory(
      `${args.hostConfig.hostname}-${args.serviceName}-handlebars-template-folder`,
      {
        serviceName: args.serviceName,
        templateDirectory: serviceDir,
        hostConfig: args.hostConfig,
      },
      {
        parent: this,
      },
    );

    for (const [templatePath, templateFile] of Object.entries(
      this.handlebarsTemplateDirectory.templateFiles,
    )) {
      this.processedTemplateCopies[templatePath] =
        new command.remote.CopyToRemote(
          `${args.hostConfig.hostname}-copy-${args.serviceName}-template-${templateFile.processedTemplate.idSafeName}`,
          {
            source: templateFile.asset.copyableSource,
            remotePath: templateFile.processedTemplate.remoteOutputPath,
            connection: args.connection,
          },
          {
            parent: this,
            dependsOn: this.copyServiceToRemote,
          },
        );
    }

    this.deployService = new command.remote.Command(
      `${args.hostConfig.hostname}-deploy-${args.serviceName}-service`,
      {
        create: `cd ${remoteServiceDirectory} && docker compose up -d --force-recreate`,
        delete: `cd ${remoteServiceDirectory} && docker compose down`,
        addPreviousOutputInEnv: false,
        triggers: [this.serviceDirectory],
        connection: args.connection,
      },
      {
        parent: this,
        dependsOn: this.copyServiceToRemote,
        hooks: {
          afterCreate: [ComposeFileUtils.checkForMissingVariables],
          afterUpdate: [ComposeFileUtils.checkForMissingVariables],
        },
        deleteBeforeReplace: true,
        additionalSecretOutputs: ['stdout', 'stderr'],
      },
    );

    this.registerOutputs({
      deployCommand: this.deployService.create,
      destroyCommand: this.deployService.delete,
      deployCommandStdout: this.deployService.stdout,
      deployCommandStderr: this.deployService.stderr,
      processedTemplates: this.prepareProcessedTemplateOutputs(),
    });
  }

  private prepareProcessedTemplateOutputs() {
    return Object.entries(this.processedTemplateCopies).reduce(
      (acc, [name, copy]) => {
        acc[`template-${name}`] = {
          remotePath: copy.remotePath,
          sourcePath: copy.source.apply((v) =>
            v instanceof pulumi.asset.FileAsset
              ? v.path
              : '(not found, something is wrong)',
          ),
        };
        return acc;
      },
      {} as pulumi.Inputs,
    );
  }
}
