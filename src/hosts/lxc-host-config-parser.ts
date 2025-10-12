import * as pulumi from "@pulumi/pulumi";
import {
  LxcHostConfigSchema,
  LxcHostConfigToml,
} from "./schema/lxc-host-config";
import { HostConfigParser, ParserConfig } from "./host-config-parser";

export class LxcHostConfigParser extends HostConfigParser<LxcHostConfigToml> {
  protected getConfig(): ParserConfig<LxcHostConfigToml> {
    return {
      type: "lxc",
      configSchema: LxcHostConfigSchema,
      errorPrefix: "LXC host",
    };
  }

  static loadAllHostConfigs(
    hostsDir: string,
  ): (LxcHostConfigToml | pulumi.Output<LxcHostConfigToml>)[] {
    const parser = new LxcHostConfigParser();
    return parser.loadAllConfigs(hostsDir);
  }

  static parseHostConfigFile<TExtraData = unknown>(
    filePath: string,
    extraData?: TExtraData,
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
