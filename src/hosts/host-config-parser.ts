import * as pulumi from "@pulumi/pulumi";
import * as path from "node:path";

import { z } from "zod";

import { PulumiSchemaParser } from "@hac/schema/pulumi/parser";
import { TomlFormat } from "@hac/schema/formats/toml";
import { ParseResult } from "@hac/schema/result";
import { TemplateProcessor } from "@hac/templates/template-processor";
import { PulumiTemplateProcessor } from "@hac/templates/pulumi/template-processor";
import { PulumiVariableResolver } from "@hac/templates/pulumi/variable-resolver";

import { sharedHandlebars } from "../templates/shared-handlebars";

export interface ParserConfig<TConfig> {
  type: "pve" | "lxc";
  configSchema: z.ZodSchema<TConfig>;
}

export abstract class HostConfigParser<TConfig> {
  protected abstract getConfig(): ParserConfig<TConfig>;

  /**
   * Get or create a PulumiSchemaParser for this config type.
   * Subclasses can override to provide a cached instance.
   */
  protected getParser(): PulumiSchemaParser<z.ZodSchema<TConfig>> {
    const config = this.getConfig();
    return new PulumiSchemaParser(config.configSchema);
  }

  /**
   * Load all host configurations from a directory.
   * Returns an array of ParseResult wrapped in Pulumi Outputs.
   */
  public loadAllConfigs(
    hostsDir: string,
    extraData?: object,
  ): pulumi.Output<ParseResult<TConfig>>[] {
    const results: pulumi.Output<ParseResult<TConfig>>[] = [];
    const configFiles = TemplateProcessor.discoverTemplateFiles(hostsDir);

    for (const configPath of configFiles) {
      const result = this.parseConfigFile(configPath, extraData);
      results.push(result);
    }

    return results;
  }

  /**
   * Parse a host configuration file.
   */
  public parseConfigFile(
    filePath: string,
    extraData?: object,
  ): pulumi.Output<ParseResult<TConfig>> {
    const fileName = path.basename(filePath);
    const identifier = `${this.getConfig().type}#${fileName.substring(0, fileName.indexOf("."))}`;
    const resolver = new PulumiVariableResolver(new pulumi.Config(identifier));
    const processor = new PulumiTemplateProcessor(resolver, {
      handlebars: sharedHandlebars,
    });
    const renderedTemplate = processor.processTemplateFile(filePath, extraData);

    return this.parseConfigString(renderedTemplate.content);
  }

  /**
   * Parse host configuration from TOML string.
   */
  public parseConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<ParseResult<TConfig>> {
    return this.getParser().parse(tomlContent, TomlFormat);
  }
}
