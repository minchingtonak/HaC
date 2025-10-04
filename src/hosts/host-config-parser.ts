import * as fs from "node:fs";
import * as pulumi from "@pulumi/pulumi";
import TOML from "smol-toml";
import { z } from "zod";
import { TemplateProcessor } from "../templates/template-processor";

export interface ParserConfig<TConfig, THostnameConfig> {
  configSchema: z.ZodSchema<TConfig>;
  hostnameSchema: z.ZodSchema<THostnameConfig>;
  extractIdentifier: (parsed: THostnameConfig) => string;
  errorPrefix: string;
}

export abstract class HostConfigParser<TConfig, THostnameConfig> {
  protected abstract getConfig(): ParserConfig<TConfig, THostnameConfig>;

  /**
   * Load all host configurations from a directory
   */
  public loadAllConfigs(
    hostsDir: string,
    extraData?: unknown,
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
    extraData?: unknown,
  ): TConfig | pulumi.Output<TConfig> {
    const identifier = this.getIdentifierFromConfigFile(filePath);
    const renderedTemplate = TemplateProcessor.processTemplate(
      filePath,
      new pulumi.Config(identifier),
      extraData,
    );

    return this.parseConfigString(renderedTemplate.content);
  }

  /**
   * Extract identifier from config file for Pulumi config lookup
   * TODO: find more efficient way of getting this info that avoids reading/parsing/validating twice
   */
  protected getIdentifierFromConfigFile(filePath: string): string {
    const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
    const parsed = TOML.parse(fileContent);
    const config = this.getConfig();

    try {
      const hostnameConfig = config.hostnameSchema.parse(parsed);
      return config.extractIdentifier(hostnameConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues
          .map((err: z.core.$ZodIssue) => {
            return JSON.stringify(err); // FIXME this may crash when err.path contains symbol values
          })
          .join("\n;\n");
        throw new Error(
          `Invalid ${config.errorPrefix} TOML structure: ${errorMessages}`,
        );
      }
      throw error;
    }
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
  private static validateConfig<TConfig, THostnameConfig>(
    config: unknown,
    parserConfig: ParserConfig<TConfig, THostnameConfig>,
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
