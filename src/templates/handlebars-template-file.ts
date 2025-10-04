import * as pulumi from "@pulumi/pulumi";
import { RenderedTemplateFile, TemplateProcessor } from "./template-processor";
import { CopyableAsset } from "@hanseltime/pulumi-file-utils";

export type HandlebarsTemplateFileArgs = {
  templatePath: string;
  configNamespace: string;
  templateContext: Record<string, unknown>;
};

export class HandlebarsTemplateFile extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = "HaC:templates:HandlebarsTemplateFile";

  processedTemplate: RenderedTemplateFile;

  asset: CopyableAsset;

  constructor(
    name: string,
    args: HandlebarsTemplateFileArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HandlebarsTemplateFile.RESOURCE_TYPE, name, {}, opts);

    this.processedTemplate = TemplateProcessor.processTemplate(
      args.templatePath,
      new pulumi.Config(args.configNamespace),
      args.templateContext,
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
