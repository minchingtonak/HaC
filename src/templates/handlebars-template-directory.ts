import * as pulumi from "@pulumi/pulumi";
import { TemplateProcessor } from "./template-processor";
import { HandlebarsTemplateFile } from "./handlebars-template-file";
import { TemplateContext } from "./template-context";

export type HandlebarsTemplateDirectoryArgs<
  TContext extends Record<string, unknown>,
> = {
  templateDirectory: string;
  configNamespace: string;
  templateContext: TemplateContext<TContext>;
  recurse?: boolean;
};

export class HandlebarsTemplateDirectory<
  TContext extends Record<string, unknown> = Record<string, unknown>,
>
  extends pulumi.ComponentResource
{
  public static RESOURCE_TYPE = "HaC:templates:HandlebarsTemplateDirectory";

  templateFiles: { [templatePath: string]: HandlebarsTemplateFile } = {};

  constructor(
    name: string,
    args: HandlebarsTemplateDirectoryArgs<TContext>,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HandlebarsTemplateDirectory.RESOURCE_TYPE, name, {}, opts);

    const templateFilePaths = TemplateProcessor.discoverTemplateFiles(
      args.templateDirectory,
      { recursive: args.recurse },
    );

    for (const templatePath of templateFilePaths) {
      this.templateFiles[templatePath] = new HandlebarsTemplateFile(
        `${name}-${TemplateProcessor.buildSanitizedNameForId(templatePath)}`,
        {
          templatePath,
          configNamespace: args.configNamespace,
          templateContext: args.templateContext,
        },
        { parent: this },
      );
    }

    this.registerOutputs();
  }
}
