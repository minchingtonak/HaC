import * as pulumi from "@pulumi/pulumi";
import * as path from "node:path";

import type { TemplateDelegate } from "handlebars";
import { z } from "zod";

import { PulumiSchemaParser } from "@hac/schema/pulumi/parser";
import { TomlFormat } from "@hac/schema/formats/toml";
import { ParseResult } from "@hac/schema/result";
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

type HostConfigType = "pve" | "lxc";

/**
 * Context variables available when rendering the config namespace template.
 */
export interface ConfigNamespaceTemplateContext {
  parser_type: HostConfigType;
  /** The filename including extensions (e.g., "my-host.hbs.toml") */
  file_name: string;
  /** The full absolute path to the file */
  file_path: string;
  /** The name of the parent directory (e.g., "lxc") */
  dir_name: string;
}

export class HostConfigParser<TConfig> {
  private readonly parser: PulumiSchemaParser<z.ZodSchema<TConfig>>;
  private readonly compiledNamespaceTemplate: TemplateDelegate<ConfigNamespaceTemplateContext>;

  private constructor(
    private readonly type: HostConfigType,
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
    type: HostConfigType,
    schema: z.ZodSchema<T>,
    configNamespaceTemplate: string,
  ): HostConfigParser<T> {
    return new HostConfigParser(type, schema, configNamespaceTemplate);
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
    const templateContext: ConfigNamespaceTemplateContext = {
      parser_type: this.type,
      file_name: path.basename(filePath),
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

    return this.parseConfigString(renderedTemplate.content);
  }

  /**
   * Parse host configuration from TOML string.
   */
  public parseConfigString(
    tomlContent: pulumi.Output<string>,
  ): pulumi.Output<ParseResult<TConfig>> {
    return this.parser.parse(tomlContent, TomlFormat);
  }
}

const CONFIG_NAMESPACE_TEMPLATE =
  "{{{parser_type}}}#{{{trimExtension file_name}}}";

export const lxcConfigParser: HostConfigParser<LxcHostConfigToml> =
  HostConfigParser.create(
    "lxc",
    LxcHostConfigSchema,
    CONFIG_NAMESPACE_TEMPLATE,
  );

export const pveConfigParser: HostConfigParser<PveHostConfigToml> =
  HostConfigParser.create(
    "pve",
    PveHostConfigSchema,
    CONFIG_NAMESPACE_TEMPLATE,
  );
