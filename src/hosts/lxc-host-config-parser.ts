import * as pulumi from "@pulumi/pulumi";
import {
  LxcHostConfigSchema,
  LxcHostConfigToml,
  LxcHostnameSchema,
  LxcHostnameToml,
} from "./lxc-host-config-schema";
import { HostConfigParser, ParserConfig } from "./host-config-parser";

export class LxcHostConfigParser extends HostConfigParser<
  LxcHostConfigToml,
  LxcHostnameToml
> {
  protected getConfig(): ParserConfig<LxcHostConfigToml, LxcHostnameToml> {
    return {
      configSchema: LxcHostConfigSchema,
      hostnameSchema: LxcHostnameSchema,
      extractIdentifier: (parsed: LxcHostnameToml) => `lxc#${parsed.hostname}`,
      errorPrefix: "LXC host",
    };
  }

  static loadAllHostConfigs(
    hostsDir: string,
  ): (LxcHostConfigToml | pulumi.Output<LxcHostConfigToml>)[] {
    const parser = new LxcHostConfigParser();
    return parser.loadAllConfigs(hostsDir);
  }

  static parseHostConfigFile(
    filePath: string,
    extraData?: unknown,
  ): LxcHostConfigToml | pulumi.Output<LxcHostConfigToml> {
    const parser = new LxcHostConfigParser();
    return parser.parseConfigFile(filePath, extraData);
  }

  static parseHostConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<LxcHostConfigToml> {
    const parser = new LxcHostConfigParser();
    return parser.parseConfigString(tomlContent);
  }
}
