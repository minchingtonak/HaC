import * as pulumi from '@pulumi/pulumi';
import { TemplateProcessor } from './template-processor';
import { HandlebarsTemplateFile } from './handlebars-template-file';

export type HandlebarsTemplateDirectoryArgs<
  TContext = Record<string, unknown>,
> = {
  templateDirectory: string;
  configNamespace: string;
  templateContext: TContext;
  recurse?: boolean;
};

export class HandlebarsTemplateDirectory<
  TContext = Record<string, unknown>,
> extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = 'HaC:templates:HandlebarsTemplateDirectory';

  templateFiles: { [templatePath: string]: HandlebarsTemplateFile } = {};

  constructor(
    name: string,
    args: HandlebarsTemplateDirectoryArgs<TContext>,
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
        `${name}-${TemplateProcessor.buildSanitizedNameForId(
          templatePath,
        )}`,
        {
          templatePath,
          configNamespace: args.configNamespace,
          templateContext: { ...args.templateContext, templatePath },
        },
        {
          parent: this,
        },
      );
    }

    this.registerOutputs();
  }
}
