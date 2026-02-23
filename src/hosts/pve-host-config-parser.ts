import * as pulumi from "@pulumi/pulumi";

import { ParseResult } from "@hac/schema/result";

import {
  PveHostConfigSchema,
  PveHostConfigToml,
} from "./schema/pve-host-config";
import { HostConfigParser, ParserConfig } from "./host-config-parser";

export class PveHostConfigParser extends HostConfigParser<PveHostConfigToml> {
  protected getConfig(): ParserConfig<PveHostConfigToml> {
    return { type: "pve", configSchema: PveHostConfigSchema };
  }

  static loadAllPveHostConfigs(
    pveHostsDir: string,
  ): pulumi.Output<ParseResult<PveHostConfigToml>>[] {
    const parser = new PveHostConfigParser();
    return parser.loadAllConfigs(pveHostsDir);
  }

  static parsePveHostConfigFile(
    filePath: string,
    extraData?: object,
  ): pulumi.Output<ParseResult<PveHostConfigToml>> {
    const parser = new PveHostConfigParser();
    return parser.parseConfigFile(filePath, extraData);
  }

  static parsePveHostConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<ParseResult<PveHostConfigToml>> {
    const parser = new PveHostConfigParser();
    return parser.parseConfigString(tomlContent);
  }
}
