import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as path from "node:path";
import { HandlebarsTemplateDirectory } from "../templates/handlebars-template-directory";
import { ComposeStackUtils } from "./compose-file-processor";
import { TemplateProcessor } from "../templates/template-processor";
import { TemplateContext } from "../templates/template-context";
import { type HomelabContainerContext } from "../proxmox/homelab-container";
import { PveHostConfigToml } from "../hosts/schema/pve-host-config";
import { LxcHostConfigToml } from "../hosts/schema/lxc-host-config";

export type ComposeStackContext = HomelabContainerContext & {
  templateDirectory: string;
};

export type TemplateFileContext = {
  pve: PveHostConfigToml;
  pve_hosts: PveHostConfigToml[];
  lxc: LxcHostConfigToml;
  lxc_hosts: LxcHostConfigToml[];
  stack_name: string;
  template_path: string;
};

export type ComposeStackArgs = {
  connection: command.types.input.remote.ConnectionArgs;
  context: TemplateContext<ComposeStackContext>;
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

    const contextData = args.context.get(
      "stackName",
      "lxcConfig",
      "lxc_config",
      "pveConfig",
      "pve_config",
      "enabledLxcHosts",
      "enabled_lxc_hosts",
      "enabledPveHosts",
      "enabled_pve_hosts",
    );

    const stackDirectory = ComposeStackUtils.STACK_DIRECTORY_FOR(
      contextData.stackName,
    );

    this.stackDirectoryAsset = new pulumi.asset.FileArchive(stackDirectory);

    const remoteStackDirectory = path.join(
      TemplateProcessor.REMOTE_STACK_DIRECTORY_ROOT,
      contextData.stackName,
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
      new HandlebarsTemplateDirectory<TemplateFileContext>(
        `${name}-template-dir`,
        {
          templateDirectory: stackDirectory,
          configNamespace: `lxc#${contextData.lxcConfig.hostname}#${contextData.stackName}`,
          templateContext: new TemplateContext<TemplateFileContext>({
            pve: contextData.pve_config,
            pve_hosts: contextData.enabled_pve_hosts,
            lxc: contextData.lxc_config,
            lxc_hosts: contextData.enabled_lxc_hosts,
            stack_name: contextData.stackName,
            template_path: stackDirectory,
          }),
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

function buildBaseDomain(context: TemplateFileContext): string {
  return `${context.lxc.hostname}.pulumi.${context.pve.node}.${context.pve.lxc.network.domain}`;
}

TemplateProcessor.registerTemplateHelper(
  "domainForApp",
  (appName: string, options: Handlebars.HelperOptions) => {
    const context = options.data as TemplateFileContext;
    const subdomainPrefix =
      context.lxc.stacks?.[context.stack_name].subdomain_prefixes?.[appName] ??
      appName;

    return `${subdomainPrefix}.${buildBaseDomain(context)}`;
  },
);

TemplateProcessor.registerTemplateHelper(
  "domainForContainer",
  (options: Handlebars.HelperOptions) => {
    const context = options.data as TemplateFileContext;

    return buildBaseDomain(context);
  },
);
