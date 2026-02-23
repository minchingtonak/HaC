import * as pulumi from "@pulumi/pulumi";
import { CopyableAsset } from "@hanseltime/pulumi-file-utils";

import { type RenderedTemplateFile } from "../../template-processor-interface";
import { type TemplateContext } from "../../template-context";
import { pathToResourceId } from "../path-utils";
import { PulumiTemplateProcessor } from "../pulumi-template-processor";
import { PulumiVariableResolver } from "../pulumi-variable-resolver";
import { type HandlebarsInstance } from "../../handlebars-instance";

/**
 * Arguments for creating a TemplateFile resource.
 */
export type TemplateFileArgs<TContext extends Record<string, unknown>> = {
  /** Path to the template file */
  templatePath: string;
  /** Pulumi config namespace for variable resolution */
  configNamespace: string;
  /** Template context data */
  templateContext: TemplateContext<TContext>;
  /**
   * Custom Handlebars instance. If not provided, a new one is created.
   * Use this to share an instance between template files or to register
   * custom helpers.
   */
  handlebars?: HandlebarsInstance;
};

/**
 * A Pulumi ComponentResource that processes a single Handlebars template file.
 *
 * This resource:
 * 1. Reads the template file
 * 2. Discovers and resolves all variables (including nested references)
 * 3. Renders the template with Handlebars
 * 4. Creates a CopyableAsset that can be deployed to remote hosts
 *
 * @example
 * ```typescript
 * const templateFile = new TemplateFile("my-config", {
 *   templatePath: "configs/app.hbs.toml",
 *   configNamespace: "myapp",
 *   templateContext: new TemplateContext().withData({ env: "production" }),
 * });
 *
 * // Use templateFile.asset to copy to remote
 * ```
 */
export class TemplateFile<
  TContext extends Record<string, unknown> = Record<string, unknown>,
>
  extends pulumi.ComponentResource
{
  public static RESOURCE_TYPE = "HaC:templates:HandlebarsTemplateFile";

  idSafeName: string;

  processedTemplate: RenderedTemplateFile<pulumi.Output<string>>;

  asset: CopyableAsset;

  processor: PulumiTemplateProcessor;

  constructor(
    name: string,
    args: TemplateFileArgs<TContext>,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(TemplateFile.RESOURCE_TYPE, name, {}, opts);

    this.idSafeName = pathToResourceId(args.templatePath);

    const resolver = new PulumiVariableResolver(
      new pulumi.Config(args.configNamespace),
    );

    this.processor = new PulumiTemplateProcessor(resolver, {
      handlebars: args.handlebars,
    });

    this.processedTemplate = this.processor.processTemplateFile(
      args.templatePath,
      args.templateContext.get(),
    );

    this.asset = new CopyableAsset(
      `${name}-rendered-template-${this.idSafeName}`,
      {
        asset:
          pulumi.Output.isInstance(this.processedTemplate.content) ?
            this.processedTemplate.content.apply(
              (val) => new pulumi.asset.StringAsset(val),
            )
          : new pulumi.asset.StringAsset(this.processedTemplate.content),
        synthName: this.idSafeName,
        tmpCopyDir: "tmp",
        noClean: false,
      },
    );

    this.registerOutputs();
  }
}
