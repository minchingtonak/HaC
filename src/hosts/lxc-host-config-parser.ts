import * as pulumi from "@pulumi/pulumi";

import { ParseResult } from "@hac/schema/result";

import {
  LxcHostConfigSchema,
  LxcHostConfigToml,
} from "./schema/lxc-host-config";
import { HostConfigParser, ParserConfig } from "./host-config-parser";

export class LxcHostConfigParser extends HostConfigParser<LxcHostConfigToml> {
  protected getConfig(): ParserConfig<LxcHostConfigToml> {
    return { type: "lxc", configSchema: LxcHostConfigSchema };
  }

  static loadAllHostConfigs(
    hostsDir: string,
  ): pulumi.Output<ParseResult<LxcHostConfigToml>>[] {
    const parser = new LxcHostConfigParser();
    return parser.loadAllConfigs(hostsDir);
  }

  static parseHostConfigFile(
    filePath: string,
    extraData?: object,
  ): pulumi.Output<ParseResult<LxcHostConfigToml>> {
    const parser = new LxcHostConfigParser();
    return parser.parseConfigFile(filePath, extraData);
  }

  static parseHostConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<ParseResult<LxcHostConfigToml>> {
    const parser = new LxcHostConfigParser();
    return parser.parseConfigString(tomlContent);
  }
}
