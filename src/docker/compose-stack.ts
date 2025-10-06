import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as path from "node:path";
import { HandlebarsTemplateDirectory } from "../templates/handlebars-template-directory";
import { ComposeStackUtils } from "./compose-file-processor";
import { LxcHostConfigToml } from "../hosts/lxc-host-config-schema";
import {
  ComposeStackTemplateContext,
  TemplateProcessor,
} from "../templates/template-processor";
import { PveHostConfigToml } from "../hosts/pve-host-config-schema";

export type ComposeStackArgs = {
  stackName: string;
  connection: command.types.input.remote.ConnectionArgs;
  lxcConfig: LxcHostConfigToml;
  pveConfig: PveHostConfigToml;
};

export class ComposeStack extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = "HaC:docker:ComposeStack";

  private static readonly PRUNE_LOCKFILE_PATH =
    "/tmp/HaC-compose-stack-prune.lock";

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

    const remoteStackDirectory = path.join(
      TemplateProcessor.REMOTE_STACK_DIRECTORY_ROOT,
      args.stackName,
    );

    // copy static files in stack directory, including unrendered templates
    this.copyStackToRemote = new command.remote.CopyToRemote(
      `${name}-copy-stack-dir`,
      {
        source: this.stackDirectoryAsset,
        remotePath: TemplateProcessor.REMOTE_STACK_DIRECTORY_ROOT,
        connection: args.connection,
      },
      { parent: this },
    );

    this.handlebarsTemplateDirectory =
      new HandlebarsTemplateDirectory<ComposeStackTemplateContext>(
        `${name}-template-dir`,
        {
          templateDirectory: stackDirectory,
          configNamespace: `lxc#${args.lxcConfig.hostname}#${args.stackName}`,
          templateContext: {
            lxc: args.lxcConfig,
            pve: args.pveConfig,
            stackName: args.stackName,
            templateDirectory: stackDirectory,
          },
        },
        { parent: this },
      );

    // copy rendered template files
    for (const [templatePath, templateFile] of Object.entries(
      this.handlebarsTemplateDirectory.templateFiles,
    )) {
      const stacksRelativePath = templatePath.substring(
        templatePath.indexOf(TemplateProcessor.LOCAL_STACKS_FOLDER_ROOT_NAME),
      );

      this.processedTemplateCopies[templatePath] =
        new command.remote.CopyToRemote(
          `${name}-copy-rendered-${templateFile.processedTemplate.idSafeName}`,
          {
            source: templateFile.asset.copyableSource,
            remotePath: ComposeStack.getRemoteOutputPath(stacksRelativePath),
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
      `${name}-delete-stack-dir`,
      { delete: `rm -rf ${remoteStackDirectory}`, connection: args.connection },
      { parent: this, dependsOn: this.copyStackToRemote },
    );

    // commands that run an image prune use locking to prevent multiple prunes running at once and to prevent a prune deleting an image that is in the processing of starting up
    // wait for the lock: flock -w <timeout-seconds> <lockfile-path> -c "true"
    // open the lock: exec <fd-N>>"<lockfile-path>"
    // acquire the lock: flock -x <fd-N>
    // release the lock: exec <fd-N>>&- (also released when the shell terminates)
    const waitForAndAcquireLock = [
      `flock -w 300 "${ComposeStack.PRUNE_LOCKFILE_PATH}" -c "true"`,
      `exec 226>"${ComposeStack.PRUNE_LOCKFILE_PATH}"`,
      `flock -x 226`,
    ];

    this.deployStack = new command.remote.Command(
      `${name}-deploy-stack`,
      {
        create: [
          `cd ${remoteStackDirectory}`,
          "docker compose pull",
          ...waitForAndAcquireLock,
          "docker compose up -d --force-recreate",
        ].join(" && "),
        update: [
          `cd ${remoteStackDirectory}`,
          "docker compose pull",
          ...waitForAndAcquireLock,
          "docker compose down --remove-orphans",
          "docker compose up -d --force-recreate",
          "docker image prune -a -f",
        ].join(" && "),
        delete: [
          `cd ${remoteStackDirectory}`,
          ...waitForAndAcquireLock,
          "docker compose down --remove-orphans",
          "docker image prune -a -f",
        ].join(" && "),
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
        additionalSecretOutputs: ["stdout", "stderr"],
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

  private static getRemoteOutputPath(templatePath: string): string {
    return path.join(
      TemplateProcessor.REMOTE_OUTPUT_FOLDER_ROOT,
      TemplateProcessor.removeTemplateExtensions(templatePath),
    );
  }

  private prepareProcessedTemplateOutputs() {
    return Object.entries(this.processedTemplateCopies).reduce(
      (acc, [name, copy]) => {
        acc[`template-${name}`] = {
          remotePath: copy.remotePath,
          sourcePath: copy.source.apply((v) =>
            v instanceof pulumi.asset.FileAsset ?
              v.path
            : "(not found, something is wrong)",
          ),
        };
        return acc;
      },
      {} as pulumi.Inputs,
    );
  }
}
