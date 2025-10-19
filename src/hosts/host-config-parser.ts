import * as pulumi from "@pulumi/pulumi";
import TOML from "smol-toml";
import { z } from "zod";
import { TemplateProcessor } from "../templates/template-processor";
import path from "node:path";

export interface ParserConfig<TConfig> {
  type: "pve" | "lxc";
  configSchema: z.ZodSchema<TConfig>;
  errorPrefix: string;
}

export abstract class HostConfigParser<TConfig> {
  protected abstract getConfig(): ParserConfig<TConfig>;

  /**
   * Load all host configurations from a directory
   */
  public loadAllConfigs(
    hostsDir: string,
    extraData?: object,
  ): (TConfig | pulumi.Output<TConfig>)[] {
    const configs: (TConfig | pulumi.Output<TConfig>)[] = [];
    const configFiles = TemplateProcessor.discoverTemplateFiles(hostsDir);

    for (const configPath of configFiles) {
      try {
        const config = this.parseConfigFile(configPath, extraData);
        configs.push(config);
      } catch (error) {
        console.warn(
          `Warning: Failed to load ${
            this.getConfig().errorPrefix
          } config from ${configPath}:`,
          error,
        );
      }
    }

    return configs;
  }

  /**
   * Parse a host configuration file
   */
  public parseConfigFile(
    filePath: string,
    extraData?: object,
  ): TConfig | pulumi.Output<TConfig> {
    const fileName = path.basename(filePath);
    const identifier = `${this.getConfig().type}#${fileName.substring(0, fileName.indexOf("."))}`;
    const renderedTemplate = TemplateProcessor.processTemplate(
      filePath,
      new pulumi.Config(identifier),
      extraData,
    );

    return this.parseConfigString(renderedTemplate.content);
  }

  /**
   * Parse host configuration from TOML string
   */
  public parseConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<TConfig> {
    const config = this.getConfig();

    function parseAndValidate(tomlContent: string): TConfig {
      const parsed = TOML.parse(tomlContent);
      return HostConfigParser.validateConfig(parsed, config);
    }

    return tomlContent.apply(parseAndValidate);
  }

  /**
   * Validate parsed configuration against schema
   */
  private static validateConfig<TConfig>(
    config: unknown,
    parserConfig: ParserConfig<TConfig>,
  ): TConfig {
    try {
      return parserConfig.configSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues
          .map((err: z.core.$ZodIssue) => {
            return JSON.stringify(err); // FIXME this may crash when err.path contains symbol values
          })
          .join("\n;\n");
        throw new Error(
          `Invalid ${parserConfig.errorPrefix} TOML structure: ${errorMessages}`,
        );
      }
      throw error;
    }
  }
}
