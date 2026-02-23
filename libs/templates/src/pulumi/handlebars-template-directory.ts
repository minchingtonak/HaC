import * as pulumi from "@pulumi/pulumi";

import { TemplateProcessor } from "../template-processor";
import { type TemplateContext } from "../template-context";
import { HandlebarsTemplateFile } from "./handlebars-template-file";
import { PulumiTemplateProcessor } from "./pulumi-template-processor";

/**
 * Arguments for creating a HandlebarsTemplateDirectory resource.
 */
export type HandlebarsTemplateDirectoryArgs<
  TContext extends Record<string, unknown>,
> = {
  /** Path to the directory containing template files */
  templateDirectory: string;
  /** Pulumi config namespace for variable resolution */
  configNamespace: string;
  /** Template context data */
  templateContext: TemplateContext<TContext>;
  /** Whether to recursively search subdirectories (default: true) */
  recurse?: boolean;
};

/**
 * A Pulumi ComponentResource that processes all Handlebars templates in a directory.
 *
 * This resource:
 * 1. Discovers all template files (*.hbs.*, *.handlebars.*) in the directory
 * 2. Creates a HandlebarsTemplateFile for each discovered template
 * 3. Exposes the processed templates as a map keyed by original path
 *
 * @example
 * ```typescript
 * const templates = new HandlebarsTemplateDirectory("app-configs", {
 *   templateDirectory: "configs/",
 *   configNamespace: "myapp",
 *   templateContext: new TemplateContext().withData({ env: "production" }),
 *   recurse: true,
 * });
 *
 * // Access individual template files
 * const appConfig = templates.templateFiles["configs/app.hbs.toml"];
 * ```
 */
export class HandlebarsTemplateDirectory<
  TContext extends Record<string, unknown> = Record<string, unknown>,
>
  extends pulumi.ComponentResource
{
  public static RESOURCE_TYPE = "HaC:templates:HandlebarsTemplateDirectory";

  /** Map of template path to processed HandlebarsTemplateFile */
  templateFiles: { [templatePath: string]: HandlebarsTemplateFile<TContext> } =
    {};

  constructor(
    name: string,
    args: HandlebarsTemplateDirectoryArgs<TContext>,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HandlebarsTemplateDirectory.RESOURCE_TYPE, name, {}, opts);

    const templateFilePaths = TemplateProcessor.discoverTemplateFiles(
      args.templateDirectory,
      { recursive: args.recurse ?? true },
    );

    for (const templatePath of templateFilePaths) {
      this.templateFiles[templatePath] = new HandlebarsTemplateFile(
        `${name}-${PulumiTemplateProcessor.buildSanitizedNameForId(templatePath)}`,
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
