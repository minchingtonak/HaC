import * as pulumi from "@pulumi/pulumi";
import * as path from "node:path";

import type { TemplateDelegate } from "handlebars";
import { z } from "zod";

import { PulumiSchemaParser } from "@hac/schema/pulumi/parser";
import { TomlFormat } from "@hac/schema/formats/toml";
import {
  FileParseError,
  FileParseResult,
  partitionFileParseResults,
} from "@hac/schema/file-result";
import { ParseResult } from "@hac/schema/result";
import { TemplateProcessor } from "@hac/templates/template-processor";
import { PulumiTemplateProcessor } from "@hac/templates/pulumi/template-processor";
import { PulumiVariableResolver } from "@hac/templates/pulumi/variable-resolver";
import { ConfigNamespaceTemplateContext as BaseConfigNamespaceTemplateContext } from "@hac/templates/pulumi/template-file";

import { sharedHandlebars } from "../templates/shared-handlebars";

type ConfigType = "pve" | "lxc";

/**
 * Log file parse errors using Pulumi's logging system.
 */
export function logFileParseErrors(errors: FileParseError[]): void {
  errors.forEach(({ filePath, error }) => {
    switch (error.kind) {
      case "format":
        pulumi.log.warn(
          `[${filePath}] ${error.formatName} ${error.kind} error:\n${error.message}${error.cause ? ` (${error.cause})` : ""}`,
        );
        break;
      case "validation":
        pulumi.log.warn(`[${filePath}] ${error.kind} error:\n${error.message}`);
        break;
    }
  });
}

/**
 * Context variables available when rendering the config namespace template.
 * Extends the base context with parser-specific fields.
 */
export interface ConfigNamespaceTemplateContext extends BaseConfigNamespaceTemplateContext {
  parserType: ConfigType;
}

export class ConfigParser<TConfig> {
  private readonly parser: PulumiSchemaParser<z.ZodSchema<TConfig>>;
  private readonly compiledNamespaceTemplate: TemplateDelegate<ConfigNamespaceTemplateContext>;

  private constructor(
    private readonly type: ConfigType,
    configSchema: z.ZodSchema<TConfig>,
    configNamespaceTemplate: string,
  ) {
    this.parser = new PulumiSchemaParser(configSchema);
    this.compiledNamespaceTemplate =
      sharedHandlebars.compile<ConfigNamespaceTemplateContext>(
        configNamespaceTemplate,
      );
  }

  static create<T>(
    type: ConfigType,
    schema: z.ZodSchema<T>,
    configNamespaceTemplate: string,
  ): ConfigParser<T> {
    return new ConfigParser(type, schema, configNamespaceTemplate);
  }

  /**
   * Load all configurations from a directory.
   * Returns a tuple of [successfullyParsed, failedParsing] arrays wrapped in a Pulumi Output.
   */
  public loadAllConfigs(
    hostsDir: string,
    extraData?: object,
  ): pulumi.Output<readonly [TConfig[], FileParseError[]]> {
    const configFiles = TemplateProcessor.discoverTemplateFiles(hostsDir);
    const results: pulumi.Output<FileParseResult<TConfig>>[] = [];

    for (const configPath of configFiles) {
      const result = this.parseConfigFile(configPath, extraData);
      results.push(result);
    }

    return pulumi.all(results).apply((resolvedResults) => {
      return partitionFileParseResults(
        resolvedResults as FileParseResult<TConfig>[],
      );
    });
  }

  /**
   * Parse a configuration file.
   */
  public parseConfigFile(
    filePath: string,
    extraData?: object,
  ): pulumi.Output<FileParseResult<TConfig>> {
    const fileName = path.basename(filePath);
    const templateContext: ConfigNamespaceTemplateContext = {
      parserType: this.type,
      fileName: fileName,
      filePath: filePath,
      dirName: path.basename(path.dirname(filePath)),
    };
    const configNamespace = this.compiledNamespaceTemplate(templateContext);

    const resolver = new PulumiVariableResolver(
      new pulumi.Config(configNamespace),
    );

    const processor = new PulumiTemplateProcessor(resolver, {
      handlebars: sharedHandlebars,
    });
    const renderedTemplate = processor.processTemplateFile(filePath, extraData);

    return this.parseConfigString(renderedTemplate.content).apply(
      (result): FileParseResult<TConfig> => {
        if (result.success) {
          return result;
        }
        return {
          success: false,
          error: { filePath, fileName, error: result.error },
        };
      },
    );
  }

  /**
   * Parse configuration from TOML string.
   */
  public parseConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<ParseResult<TConfig>> {
    return this.parser.parse(tomlContent, TomlFormat);
  }
}
