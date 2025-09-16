import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as path from 'node:path';
import { HandlebarsTemplateDirectory } from '../templates/handlebars-template-directory';
import { ComposeStackUtils } from './compose-file-processor';
import { HostConfigToml } from '../hosts/host-config-schema';
import { TemplateProcessor } from '../templates/template-processor';

export type StackName = string;

export type ComposeStackArgs = {
  stackName: StackName;
  connection: command.types.input.remote.ConnectionArgs;
  hostConfig: HostConfigToml;
};

export class ComposeStack extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = 'HaC:docker:ComposeStack';

  stackDirectoryAsset: pulumi.asset.FileAsset;

  copyStackToRemote: command.remote.CopyToRemote;

  deleteStackFolder: command.remote.Command;

  handlebarsTemplateDirectory: HandlebarsTemplateDirectory;

  processedTemplateCopies: {
    [templatePath: string]: command.remote.CopyToRemote;
  } = {};

  deployStack: command.remote.Command;

  constructor(
    name: string,
    args: ComposeStackArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(ComposeStack.RESOURCE_TYPE, name, {}, opts);

    const stackDirectory = ComposeStackUtils.STACK_DIRECTORY_FOR(
      args.stackName,
    );

    this.stackDirectoryAsset = new pulumi.asset.FileArchive(stackDirectory);

    const remoteStackDirectoryBase = `${TemplateProcessor.REMOTE_OUTPUT_FOLDER_ROOT}/stacks`; // TODO make configurable?
    const remoteStackDirectory = path.join(
      remoteStackDirectoryBase,
      args.stackName,
    );

    // copy static files in stack directory, including unrendered templates
    this.copyStackToRemote = new command.remote.CopyToRemote(
      `${args.hostConfig.hostname}-copy-${args.stackName}-stack-directory`,
      {
        source: this.stackDirectoryAsset,
        remotePath: remoteStackDirectoryBase,
        connection: args.connection,
      },
      {
        parent: this,
      },
    );

    this.handlebarsTemplateDirectory = new HandlebarsTemplateDirectory(
      `${args.hostConfig.hostname}-${args.stackName}-handlebars-template-folder`,
      {
        stackName: args.stackName,
        templateDirectory: stackDirectory,
        hostConfig: args.hostConfig,
      },
      {
        parent: this,
      },
    );

    // copy rendered template files
    for (const [templatePath, templateFile] of Object.entries(
      this.handlebarsTemplateDirectory.templateFiles,
    )) {
      this.processedTemplateCopies[templatePath] =
        new command.remote.CopyToRemote(
          `${args.hostConfig.hostname}-copy-${args.stackName}-template-${templateFile.processedTemplate.idSafeName}`,
          {
            source: templateFile.asset.copyableSource,
            remotePath: templateFile.processedTemplate.remoteOutputPath,
            connection: args.connection,
          },
          {
            parent: this.handlebarsTemplateDirectory,
            dependsOn: this.copyStackToRemote,
          },
        );
    }

    // delete stack folder when removing this resource
    this.deleteStackFolder = new command.remote.Command(
      `${args.hostConfig.hostname}-delete-${args.stackName}-stack-directory`,
      { delete: `rm -rf ${remoteStackDirectory}`, connection: args.connection },
      { parent: this, dependsOn: this.copyStackToRemote },
    );

    this.deployStack = new command.remote.Command(
      `${args.hostConfig.hostname}-deploy-${args.stackName}-stack`,
      {
        create: `cd ${remoteStackDirectory} && docker compose up -d --force-recreate`,
        delete: `cd ${remoteStackDirectory} && docker compose down`,
        addPreviousOutputInEnv: false,
        triggers: [this.stackDirectoryAsset],
        connection: args.connection,
      },
      {
        parent: this,
        dependsOn: this.deleteStackFolder,
        hooks: {
          afterCreate: [ComposeStackUtils.checkForMissingVariables],
          afterUpdate: [ComposeStackUtils.checkForMissingVariables],
        },
        deleteBeforeReplace: true,
        additionalSecretOutputs: ['stdout', 'stderr'],
      },
    );


    this.registerOutputs({
      deployCommand: this.deployStack.create,
      destroyCommand: this.deployStack.delete,
      deployCommandStdout: this.deployStack.stdout,
      deployCommandStderr: this.deployStack.stderr,
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
