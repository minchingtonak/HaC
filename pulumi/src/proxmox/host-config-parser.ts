import * as fs from 'fs';
import * as path from 'path';
import * as pulumi from '@pulumi/pulumi';
import TOML from 'smol-toml';
import { z } from 'zod';
import { HostConfigSchema, HostConfigToml } from './host-config-schema';
import { EnvUtils } from '../utils/env-utils';

export class HostConfigParser {
  private static readonly HOST_CONFIG_FILENAME = 'host.toml';

  static parseHostConfigFile(filePath: string): HostConfigToml {
    const tomlContent = fs.readFileSync(filePath, 'utf-8');

    return HostConfigParser.parseHostConfigString(
      path.basename(path.dirname(filePath)),
      tomlContent,
    );
  }

  static parseHostConfigString(
    name: string,
    tomlContent: string,
  ): HostConfigToml {
    const parsed = TOML.parse(tomlContent);
    const validatedConfig = HostConfigParser.validateHostConfig(parsed);

    // skip variable resolution if not enabled
    if (!validatedConfig.enabled) {
      return validatedConfig;
    }

    const variableNames =
      HostConfigParser.extractVariableNamesFromConfig(validatedConfig);
    const hostPulumiConfig = new pulumi.Config(`host-${name}`);

    const variableValuesMap = EnvUtils.assembleVariableMapFromConfig(
      hostPulumiConfig,
      variableNames,
    );

    const processedConfig = HostConfigParser.replaceVariablesInConfig(
      validatedConfig,
      variableValuesMap,
    );

    return processedConfig;
  }

  static discoverHostConfigFiles(hostsDir: string): string[] {
    const configFiles: string[] = [];

    const hostDirs = fs
      .readdirSync(hostsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const hostDir of hostDirs) {
      const configPath = path.join(
        hostsDir,
        hostDir,
        HostConfigParser.HOST_CONFIG_FILENAME,
      );

      if (fs.existsSync(configPath)) {
        configFiles.push(configPath);
      }
    }

    return configFiles;
  }

  static loadAllHostConfigs(hostsDir: string): HostConfigToml[] {
    const configs: HostConfigToml[] = [];
    const configFiles = HostConfigParser.discoverHostConfigFiles(hostsDir);

    for (const configPath of configFiles) {
      try {
        const config = HostConfigParser.parseHostConfigFile(configPath);
        configs.push(config);
      } catch (error) {
        console.warn(
          `Warning: Failed to load config from ${configPath}:`,
          error,
        );
      }
    }

    return configs;
  }

  private static validateHostConfig(config: unknown): HostConfigToml {
    try {
      return HostConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues
          .map((err: z.core.$ZodIssue) => {
            return JSON.stringify(err); // FIXME this may crash when err.path contains symbol values
          })
          .join('\n;\n');
        throw new Error(`Invalid TOML structure: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Recursively traverses an object of arbitrary depth and extracts variable names
   * from any string values that contain ${varName} patterns
   * @param config The object to traverse
   * @returns Array of unique variable names found in all string values
   */
  private static extractVariableNamesFromConfig(
    config: HostConfigToml,
  ): string[] {
    const variableNames = new Set<string>();

    function traverse(value: unknown): void {
      if (typeof value === 'string') {
        const foundVars = EnvUtils.extractVariableNames(value);
        foundVars.forEach(variableNames.add.bind(variableNames));
      } else if (Array.isArray(value)) {
        value.forEach(traverse);
      } else if (value !== null && typeof value === 'object') {
        Object.values(value).forEach(traverse);
      }
    }

    traverse(config);
    return Array.from(variableNames);
  }

  /**
   * Recursively replaces variable references in a configuration object with their actual values
   * @param config The configuration object to process
   * @param variableValuesMap Map of variable names to their resolved values
   * @returns A new configuration object with variables replaced
   * @throws Error if a variable reference cannot be resolved
   */
  private static replaceVariablesInConfig(
    config: HostConfigToml,
    variableValuesMap: Record<string, string | pulumi.Output<string>>,
  ): HostConfigToml {
    // Deep clone the config to avoid mutating the original
    const processedConfig = structuredClone(config);

    function replaceInValue(value: unknown): unknown {
      if (typeof value === 'string') {
        return HostConfigParser.replaceVariablesInString(
          value,
          variableValuesMap,
        );
      } else if (Array.isArray(value)) {
        return value.map(replaceInValue);
      } else if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = replaceInValue(val);
        }
        return result;
      }
      return value;
    }

    return replaceInValue(processedConfig) as HostConfigToml;
  }

  /**
   * Replaces variable references in a string with their actual values
   * @param str The string containing variable references
   * @param variableValuesMap Map of variable names to their resolved values
   * @returns The string with variables replaced, or a Pulumi Output if any variables are secrets
   * @throws Error if a variable reference cannot be resolved
   */
  private static replaceVariablesInString(
    str: string,
    variableValuesMap: Record<string, string | pulumi.Output<string>>,
  ): string | pulumi.Output<string> {
    const variableNames = EnvUtils.extractVariableNames(str);

    if (variableNames.length === 0) {
      return str;
    }

    const missingVars = variableNames.filter(
      (varName) => !(varName in variableValuesMap),
    );
    if (missingVars.length > 0) {
      throw new Error(
        `Missing variable values for: ${missingVars.join(', ')}. ` +
          `Available variables: ${Object.keys(variableValuesMap).join(', ')}`,
      );
    }

    const hasSecrets = variableNames.some((varName) =>
      pulumi.Output.isInstance(variableValuesMap[varName]),
    );

    if (hasSecrets) {
      const outputs = variableNames.map(
        (varName) => variableValuesMap[varName],
      );
      return pulumi.all(outputs).apply((resolvedValues) => {
        let result = str;
        variableNames.forEach((varName, index) => {
          const pattern = new RegExp(
            `\\$\\{${HostConfigParser.escapeRegExp(varName)}\\}`,
            'g',
          );
          result = result.replace(pattern, String(resolvedValues[index]));
        });
        return result;
      });
    } else {
      let result = str;
      for (const varName of variableNames) {
        const pattern = new RegExp(
          `\\$\\{${HostConfigParser.escapeRegExp(varName)}\\}`,
          'g',
        );
        result = result.replace(pattern, String(variableValuesMap[varName]));
      }
      return result;
    }
  }

  /**
   * Escapes special regex characters in a string to make it safe for use in RegExp constructor
   * @param string The string to escape
   * @returns The escaped string safe for regex use
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
