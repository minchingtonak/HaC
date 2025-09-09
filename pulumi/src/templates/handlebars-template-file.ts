import * as pulumi from '@pulumi/pulumi';
import { RenderedTemplateFile, TemplateProcessor } from './template-processor';
import { CopyableAsset } from '@hanseltime/pulumi-file-utils';
import { HostConfigToml } from '../proxmox/host-config-schema';

export type HandlebarsTemplateFileArgs = {
  serviceName: string;
  templatePath: string;
  hostConfig: HostConfigToml;
};

export class HandlebarsTemplateFile extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = 'HaC:templates:HandlebarsTemplateFile';

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
      args.serviceName,
      args.hostConfig.hostname,
    );

    this.asset = new CopyableAsset(
      `${args.hostConfig.hostname}-${args.serviceName}-rendered-template-${this.processedTemplate.idSafeName}`,
      {
        asset: pulumi.Output.isInstance(this.processedTemplate.content)
          ? this.processedTemplate.content.apply(
              (val) => new pulumi.asset.StringAsset(val),
            )
          : new pulumi.asset.StringAsset(this.processedTemplate.content),
        synthName: this.processedTemplate.idSafeName,
        tmpCopyDir: 'tmp',
        noClean: false,
      },
    );

    this.registerOutputs();
  }
}
