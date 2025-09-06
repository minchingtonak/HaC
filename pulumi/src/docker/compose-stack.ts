import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as path from 'node:path';
import { HandlebarsTemplateDirectory } from '../templates/handlebars-template-directory';
import { ComposeFileProcessor } from './compose-file-processor';

export type ServiceName = string;

export type ComposeStackArgs = {
  serviceName: ServiceName;
  connection: command.types.input.remote.ConnectionArgs;
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

    const serviceDir = ComposeFileProcessor.SERVICE_DIRECTORY_FOR(
      args.serviceName,
    );

    this.serviceDirectory = new pulumi.asset.FileArchive(serviceDir);

    const remoteServiceDirectoryBase = '/etc/pulumi';
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

    // handle template files

    this.handlebarsTemplateDirectory = new HandlebarsTemplateDirectory(
      `${args.serviceName}-handlebars-template-folder`,
      {
        serviceName: args.serviceName,
        templateDirectory: serviceDir,
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
          `copy-${args.serviceName}-template-${templateFile.processedTemplate.idSafeName}`,
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

    // handle compose stack environment variables

    const stringifiedEnv = pulumi.secret(
      ComposeFileProcessor.getStringifiedEnvVarsForService(args.serviceName),
    );

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
          afterCreate: [ComposeFileProcessor.checkForMissingVariables],
          afterUpdate: [ComposeFileProcessor.checkForMissingVariables],
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
