import * as pulumi from '@pulumi/pulumi';
import { TemplateProcessor } from './template-processor';
import { HandlebarsTemplateFile } from './handlebars-template-file';

export type HandlebarsTemplateDirectoryArgs = {
  templateDirectory: string;
  serviceName: string;
  recurse?: boolean;
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
      args.recurse,
    );

    for (const templatePath of templateFilePaths) {
      this.templateFiles[templatePath] = new HandlebarsTemplateFile(
        `handlebars-template-file-${TemplateProcessor.buildSanitizedNameForId(
          templatePath,
        )}`,
        {
          serviceName: args.serviceName,
          templatePath,
        },
        {
          parent: this,
        },
      );
    }

    this.registerOutputs();
  }
}
