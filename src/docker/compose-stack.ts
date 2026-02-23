import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { HelperOptions } from "@hac/templates/handlebars";
import { TemplateContext } from "@hac/templates/template-context";
import { TemplateProcessor } from "@hac/templates/template-processor";
import { TemplateDirectory } from "@hac/templates/pulumi/template-directory";
import { sharedHandlebars } from "../templates/shared-handlebars";
import { STACK_CONFIG_NAMESPACE_TEMPLATE, TemplatePaths } from "../constants";
import {
  HomelabLxcHost,
  type HomelabLxcHostContext,
} from "../proxmox/homelab-lxc-host";
import { PveHostConfigToml } from "../hosts/schema/pve-host-config";
import { LxcHostConfigToml } from "../hosts/schema/lxc-host-config";
import { DualCaseContext } from "@hac/templates/dual-case-types";

export type ComposeStackContext = HomelabLxcHostContext &
  DualCaseContext<{ stack_name: string; template_directory: string }>;

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

  templateDirectory: TemplateDirectory;

  processedTemplateCopies: {
    [templatePath: string]: command.remote.CopyToRemote;
  } = {};

  deployStack: pulumi.Output<command.remote.Command>;

  constructor(
    name: string,
    args: ComposeStackArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(ComposeStack.RESOURCE_TYPE, name, {}, opts);

    const contextData = args.context.get(
      "stackName",
      "stack_name",
      "lxcConfig",
      "lxc_config",
      "pveConfig",
      "pve_config",
      "enabledLxcHosts",
      "enabled_lxc_hosts",
      "enabledPveHosts",
      "enabled_pve_hosts",
    );

    const stackDirectory = ComposeStack.STACK_DIRECTORY_FOR(
      contextData.stackName,
    );

    this.stackDirectoryAsset = new pulumi.asset.FileArchive(stackDirectory);

    const remoteStackDirectory = path.join(
      TemplatePaths.REMOTE_STACK_DIRECTORY_ROOT,
      contextData.stackName,
    );

    // copy static files in stack directory, including unrendered templates
    this.copyStackToRemote = new command.remote.CopyToRemote(
      `${name}-copy-stack-dir`,
      {
        source: this.stackDirectoryAsset,
        remotePath: TemplatePaths.REMOTE_STACK_DIRECTORY_ROOT,
        connection: args.connection,
      },
      { parent: this },
    );

    this.templateDirectory = new TemplateDirectory<TemplateFileContext>(
      `${name}-template-dir`,
      {
        templateDirectory: stackDirectory,
        configNamespace: STACK_CONFIG_NAMESPACE_TEMPLATE,
        templateContext: new TemplateContext<TemplateFileContext>({
          pve: contextData.pve_config,
          pve_hosts: contextData.enabled_pve_hosts,
          lxc: contextData.lxc_config,
          lxc_hosts: contextData.enabled_lxc_hosts,
          stack_name: contextData.stack_name,
          template_path: stackDirectory,
        }),
        handlebars: sharedHandlebars,
      },
      { parent: this },
    );

    // copy rendered template files
    for (const [templatePath, templateFile] of Object.entries(
      this.templateDirectory.templateFiles,
    )) {
      const stacksRelativePath = templatePath.substring(
        templatePath.indexOf(TemplatePaths.LOCAL_STACKS_FOLDER_ROOT_NAME),
      );

      this.processedTemplateCopies[templatePath] =
        new command.remote.CopyToRemote(
          `${name}-copy-rendered-${templateFile.idSafeName}`,
          {
            source: templateFile.asset.copyableSource,
            remotePath: ComposeStack.getRemoteOutputPath(stacksRelativePath),
            connection: args.connection,
          },
          { parent: this.templateDirectory, dependsOn: this.copyStackToRemote },
        );
    }

    // delete stack folder when removing this resource
    this.deleteStackFolder = new command.remote.Command(
      `${name}-delete-stack-dir`,
      { delete: `rm -rf ${remoteStackDirectory}`, connection: args.connection },
      { parent: this, dependsOn: this.copyStackToRemote },
    );

    this.deployStack = pulumi
      .all(
        Object.values(this.templateDirectory.templateFiles).map((tf) =>
          tf.processedTemplate.content.apply(
            (content) =>
              // use idSafeName:contentMd5 as the trigger value for better readability in cli diffs
              `${tf.idSafeName}:${crypto.createHash("md5").update(content).digest("hex")}`,
          ),
        ),
      )
      .apply((templateFileContents) => {
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

        return new command.remote.Command(
          `${name}-deploy-stack`,
          {
            create: [
              `cd ${remoteStackDirectory}`,
              ...waitForAndAcquireLock,
              "docker compose pull",
              "docker compose up -d --force-recreate",
            ].join(" && "),
            update: [
              `cd ${remoteStackDirectory}`,
              ...waitForAndAcquireLock,
              "docker compose pull",
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
            triggers: [this.stackDirectoryAsset, templateFileContents],
            connection: args.connection,
          },
          {
            parent: this,
            dependsOn: this.deleteStackFolder,
            hooks: {
              afterCreate: [ComposeStack.checkForMissingVariables],
              afterUpdate: [ComposeStack.checkForMissingVariables],
            },
            deleteBeforeReplace: true,
            additionalSecretOutputs: ["stdout", "stderr"],
          },
        );
      });

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
      TemplatePaths.REMOTE_OUTPUT_FOLDER_ROOT,
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

  static STACK_DIRECTORY_FOR = (stackName: string) =>
    `./hosts/stacks/${stackName}`;

  private static UNSET_VARIABLE_MARKER = "variable is not set";

  static checkForMissingVariables(args: pulumi.ResourceHookArgs) {
    const outputs = args.newOutputs as { stderr: string };

    const missingVars = outputs.stderr
      .split("\n")
      .filter((line) => line.includes(ComposeStack.UNSET_VARIABLE_MARKER));

    if (missingVars.length) {
      throw new Error("\n" + missingVars.join("\n"));
    }
  }
}

// use with: {{{domainForApp "appName" hostname=other-lxc-hostname,node=other-pve-node}}}
export type DomainForAppOptions = { hostname?: string; node?: string };

sharedHandlebars.registerHelper(
  "domainForApp",
  (appName: string, options: HelperOptions) => {
    const context = structuredClone(options.data) as TemplateFileContext;

    const { hostname, node } = options.hash as DomainForAppOptions;
    if (hostname) {
      // @ts-expect-error deliberately setting context property
      context.lxc.hostname = hostname;
    }
    if (node) {
      // @ts-expect-error deliberately setting context property
      context.pve.node = node;
    }

    return `${appName}.${HomelabLxcHost.CONTAINER_BASE_DOMAIN(context)}`;
  },
);
