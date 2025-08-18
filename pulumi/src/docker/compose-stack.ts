import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { HandlebarsTemplateDirectory } from '../templates/handlebars-template-directory';

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

    const serviceDir = ComposeStack.SERVICE_DIRECTORY_FOR(args.serviceName);

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

    const serviceEnv = ComposeStack.assembleVariableMap(args.serviceName);
    const stringifiedEnv = pulumi
      .all(
        Object.entries(serviceEnv).map(
          ([name, value]) =>
            // process the env vars before the apply() call to avoid exposing secrets in resource outputs
            pulumi.interpolate`${name}="${ComposeStack.escapeBashEnvValue(
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
          afterCreate: [ComposeStack.checkForMissingVariables],
          afterUpdate: [ComposeStack.checkForMissingVariables],
        },
        deleteBeforeReplace: true,
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

  private static SECRET_VARIABLE_PREFIX = 'SECRET_';

  private static SERVICE_DIRECTORY_FOR = (serviceName: string) =>
    `./stacks/${serviceName}`;

  private static COMPOSE_FILE_FOR = (serviceName: string) =>
    `${ComposeStack.SERVICE_DIRECTORY_FOR(serviceName)}/compose.yaml`;

  private static assembleVariableMap(serviceName: string) {
    const serviceConfig = new pulumi.Config(serviceName);
    const fileContent = fs.readFileSync(
      ComposeStack.COMPOSE_FILE_FOR(serviceName),
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
      if (
        varName
          .toLocaleUpperCase()
          .startsWith(ComposeStack.SECRET_VARIABLE_PREFIX)
      ) {
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

      return result.replaceAll('`', '\\`').replaceAll('!', '\\!');
    }

    if (pulumi.Output.isInstance(value)) {
      return value.apply(replacer);
    }

    return replacer(value);
  }

  private static UNSET_VARIABLE_MARKER = 'variable is not set';

  private static checkForMissingVariables(args: pulumi.ResourceHookArgs) {
    const outputs = args.newOutputs as {
      stderr: string;
    };

    const missingVars = outputs.stderr
      .split('\n')
      .filter((line) => line.includes(ComposeStack.UNSET_VARIABLE_MARKER));

    if (missingVars.length) {
      throw new Error('\n' + missingVars.join('\n'));
    }
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
