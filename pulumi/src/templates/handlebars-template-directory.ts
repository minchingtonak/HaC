import * as pulumi from '@pulumi/pulumi';
import { TemplateProcessor } from './template-processor';
import { HandlebarsTemplateFile } from './handlebars-template-file';
import { HostConfigToml } from '../hosts/host-config-schema';

export type HandlebarsTemplateDirectoryArgs = {
  templateDirectory: string;
  stackName: string;
  recurse?: boolean;
  hostConfig: HostConfigToml;
};

export class HandlebarsTemplateDirectory extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = 'HaC:templates:HandlebarsTemplateDirectory';

  templateFiles: { [templatePath: string]: HandlebarsTemplateFile } = {};

  constructor(
    name: string,
    args: HandlebarsTemplateDirectoryArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HandlebarsTemplateDirectory.RESOURCE_TYPE, name, {}, opts);

    const templateFilePaths = TemplateProcessor.discoverTemplateFiles(
      args.templateDirectory,
      {
        recursive: args.recurse,
      },
    );

    for (const templatePath of templateFilePaths) {
      this.templateFiles[templatePath] = new HandlebarsTemplateFile(
        `${args.hostConfig.hostname}-${
          args.stackName
        }-handlebars-template-file-${TemplateProcessor.buildSanitizedNameForId(
          templatePath,
        )}`,
        {
          stackName: args.stackName,
          templatePath,
          hostConfig: args.hostConfig,
        },
        {
          parent: this,
        },
      );
    }

    this.registerOutputs();
  }
}
