import * as pulumi from "@pulumi/pulumi";
import { RenderedTemplateFile, TemplateProcessor } from "./template-processor";
import { CopyableAsset } from "@hanseltime/pulumi-file-utils";
import { TemplateContext } from "./template-context";

export type HandlebarsTemplateFileArgs<
  TContext extends Record<string, unknown>,
> = {
  templatePath: string;
  configNamespace: string;
  templateContext: TemplateContext<TContext>;
};

export class HandlebarsTemplateFile<
  TContext extends Record<string, unknown> = Record<string, unknown>,
> extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = "HaC:templates:HandlebarsTemplateFile";

  processedTemplate: RenderedTemplateFile;

  asset: CopyableAsset;

  constructor(
    name: string,
    args: HandlebarsTemplateFileArgs<TContext>,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HandlebarsTemplateFile.RESOURCE_TYPE, name, {}, opts);

    this.processedTemplate = TemplateProcessor.processTemplate(
      args.templatePath,
      new pulumi.Config(args.configNamespace),
      args.templateContext.get(),
    );

    this.asset = new CopyableAsset(
      `${name}-rendered-template-${this.processedTemplate.idSafeName}`,
      {
        asset:
          pulumi.Output.isInstance(this.processedTemplate.content) ?
            this.processedTemplate.content.apply(
              (val) => new pulumi.asset.StringAsset(val),
            )
          : new pulumi.asset.StringAsset(this.processedTemplate.content),
        synthName: this.processedTemplate.idSafeName,
        tmpCopyDir: "tmp",
        noClean: false,
      },
    );

    this.registerOutputs();
  }
}
