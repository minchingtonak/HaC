import * as pulumi from "@pulumi/pulumi";
import * as path from "node:path";

import type { TemplateDelegate } from "handlebars";
import { z } from "zod";

import { PulumiSchemaParser } from "@hac/schema/pulumi/parser";
import { TomlFormat } from "@hac/schema/formats/toml";
import { ParseError, ParseResult } from "@hac/schema/result";
import { TemplateProcessor } from "@hac/templates/template-processor";
import { PulumiTemplateProcessor } from "@hac/templates/pulumi/template-processor";
import { PulumiVariableResolver } from "@hac/templates/pulumi/variable-resolver";

import { sharedHandlebars } from "../templates/shared-handlebars";
import {
  LxcHostConfigSchema,
  LxcHostConfigToml,
} from "./schema/lxc-host-config";
import {
  PveHostConfigSchema,
  PveHostConfigToml,
} from "./schema/pve-host-config";

type ConfigType = "pve" | "lxc";

/**
 * Parse error with file context for config file parsing.
 */
export type FileParseError = {
  filePath: string;
  fileName: string;
  error: ParseError;
};

/**
 * Result type for file-based parsing operations.
 */
export type FileParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: FileParseError };

/**
 * Partition an array of FileParseResults into successes and failures.
 */
export function partitionFileParseResults<T>(
  results: FileParseResult<T>[],
): readonly [T[], FileParseError[]] {
  const successes: T[] = [];
  const failures: FileParseError[] = [];

  for (const result of results) {
    if (result.success) {
      successes.push(result.data);
    } else {
      failures.push(result.error);
    }
  }

  return [successes, failures] as const;
}

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
 */
export interface ConfigNamespaceTemplateContext {
  parser_type: ConfigType;
  /** The filename including extensions (e.g., "my-host.hbs.toml") */
  file_name: string;
  /** The full absolute path to the file */
  file_path: string;
  /** The name of the parent directory (e.g., "lxc") */
  dir_name: string;
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
      parser_type: this.type,
      file_name: fileName,
      file_path: filePath,
      dir_name: path.basename(path.dirname(filePath)),
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

const CONFIG_NAMESPACE_TEMPLATE =
  "{{{parser_type}}}#{{{trimExtension file_name}}}";

export const lxcConfigParser: ConfigParser<LxcHostConfigToml> =
  ConfigParser.create("lxc", LxcHostConfigSchema, CONFIG_NAMESPACE_TEMPLATE);

export const pveConfigParser: ConfigParser<PveHostConfigToml> =
  ConfigParser.create("pve", PveHostConfigSchema, CONFIG_NAMESPACE_TEMPLATE);
