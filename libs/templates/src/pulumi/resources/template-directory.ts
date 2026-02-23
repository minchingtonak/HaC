import * as pulumi from "@pulumi/pulumi";

import { TemplateProcessor } from "../../template-processor";
import { type TemplateContext } from "../../template-context";
import { pathToResourceId } from "../path-utils";
import { TemplateFile } from "./template-file";

/**
 * Arguments for creating a TemplateDirectory resource.
 */
export type TemplateDirectoryArgs<TContext extends Record<string, unknown>> = {
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
 * 2. Creates a TemplateFile for each discovered template
 * 3. Exposes the processed templates as a map keyed by original path
 *
 * @example
 * ```typescript
 * const templates = new TemplateDirectory("app-configs", {
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
export class TemplateDirectory<
  TContext extends Record<string, unknown> = Record<string, unknown>,
>
  extends pulumi.ComponentResource
{
  public static RESOURCE_TYPE = "HaC:templates:TemplateDirectory";

  /** Map of template path to processed TemplateFile */
  templateFiles: { [templatePath: string]: TemplateFile<TContext> } = {};

  constructor(
    name: string,
    args: TemplateDirectoryArgs<TContext>,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(TemplateDirectory.RESOURCE_TYPE, name, {}, opts);

    const templateFilePaths = TemplateProcessor.discoverTemplateFiles(
      args.templateDirectory,
      { recursive: args.recurse ?? true },
    );

    for (const templatePath of templateFilePaths) {
      this.templateFiles[templatePath] = new TemplateFile(
        `${name}-${pathToResourceId(templatePath)}`,
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
