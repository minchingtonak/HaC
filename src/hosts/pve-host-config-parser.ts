import * as pulumi from "@pulumi/pulumi";
import {
  PveHostConfigSchema,
  PveHostConfigToml,
} from "./schema/pve-host-config";
import { HostConfigParser, ParserConfig } from "./host-config-parser";

export class PveHostConfigParser extends HostConfigParser<PveHostConfigToml> {
  protected getConfig(): ParserConfig<PveHostConfigToml> {
    return {
      type: "pve",
      configSchema: PveHostConfigSchema,
      errorPrefix: "PVE host",
    };
  }

  static loadAllPveHostConfigs(
    pveHostsDir: string,
  ): (PveHostConfigToml | pulumi.Output<PveHostConfigToml>)[] {
    const parser = new PveHostConfigParser();
    return parser.loadAllConfigs(pveHostsDir);
  }

  static parsePveHostConfigFile<TExtraData = unknown>(
    filePath: string,
    extraData?: TExtraData,
  ): PveHostConfigToml | pulumi.Output<PveHostConfigToml> {
    const parser = new PveHostConfigParser();
    return parser.parseConfigFile(filePath, extraData);
  }

  static parsePveHostConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<PveHostConfigToml> {
    const parser = new PveHostConfigParser();
    return parser.parseConfigString(tomlContent);
  }
}
