import * as pulumi from "@pulumi/pulumi";
import {
  PveHostConfigSchema,
  PveHostConfigToml,
  PveHostnameSchema,
  PveHostnameToml,
} from "./schema/pve-host-config";
import { HostConfigParser, ParserConfig } from "./host-config-parser";

export class PveHostConfigParser extends HostConfigParser<
  PveHostConfigToml,
  PveHostnameToml
> {
  protected getConfig(): ParserConfig<PveHostConfigToml, PveHostnameToml> {
    return {
      configSchema: PveHostConfigSchema,
      hostnameSchema: PveHostnameSchema,
      extractIdentifier: (parsed: PveHostnameToml) => `pve#${parsed.node}`,
      errorPrefix: "PVE host",
    };
  }

  static loadAllPveHostConfigs(
    pveHostsDir: string,
  ): (PveHostConfigToml | pulumi.Output<PveHostConfigToml>)[] {
    const parser = new PveHostConfigParser();
    return parser.loadAllConfigs(pveHostsDir);
  }

  static loadPveHostConfigByName(
    pveHostsDir: string,
    hostname: string,
  ): PveHostConfigToml | pulumi.Output<PveHostConfigToml> {
    const parser = new PveHostConfigParser();
    const filePath = `${pveHostsDir}/${hostname}.hbs.toml`;
    return parser.parseConfigFile(filePath);
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
