import * as pulumi from '@pulumi/pulumi';

/**
 * Utility functions for handling environment variables in various contexts
 */
export class EnvUtils {
  /**
   * Assembles a variable map from a Pulumi config for the given variable names
   * @param config The Pulumi config instance to read from
   * @param variableNames Array of variable names to read from config
   * @returns Map of variable names to their values (secrets are handled appropriately)
   */
  static assembleVariableMapFromConfig(
    config: pulumi.Config,
    variableNames: string[],
  ): Record<string, string | pulumi.Output<string>> {
    const envMap: Record<string, string | pulumi.Output<string>> = {};

    for (const varName of variableNames) {
      const { getConfigValue } = EnvUtils.resolveVariable(varName, config);
      envMap[varName] = getConfigValue();
    }

    return envMap;
  }

  private static readonly SECRET_VARIABLE_PREFIX = 'SECRET_';

  private static readonly PARENT_NAMESPACE_PREFIX = 'parent:';

  private static resolveVariable(varName: string, config: pulumi.Config) {
    let resolvedConfig = config;
    let resolvedConfigKey = varName;

    if (varName.startsWith(EnvUtils.PARENT_NAMESPACE_PREFIX)) {
      const namespace = config.name;
      if (!namespace.includes('#')) {
        throw new Error(
          `Tried to access parent of root namespace: '${namespace}'`,
        );
      }

      // remove parent: from the variable name so it can be used for config lookup
      resolvedConfigKey = varName.slice(
        EnvUtils.PARENT_NAMESPACE_PREFIX.length,
      );
      const parentNamespace = namespace.slice(0, namespace.lastIndexOf('#'));
      resolvedConfig = new pulumi.Config(parentNamespace);
    } else if (varName.includes(':')) {
      const [namespace, configVarName] = varName.split(':');
      resolvedConfig = new pulumi.Config(namespace);
      resolvedConfigKey = configVarName;
    }

    const isSecret = resolvedConfigKey
      .toLocaleUpperCase()
      .startsWith(EnvUtils.SECRET_VARIABLE_PREFIX);

    const getConfigValue = isSecret
      ? () => resolvedConfig.requireSecret(resolvedConfigKey)
      : () => resolvedConfig.require(resolvedConfigKey);

    return {
      getConfigValue,
      resolvedConfigKey,
      resolvedConfig,
    };
  }

  /**
   * Escapes a value for safe use in bash environment variable assignments
   * @param value The value to escape (can be a string or Pulumi Output)
   * @param allowVariableExpansion Whether to allow $ variable expansion (default: false)
   * @returns The escaped value
   */
  static escapeBashEnvValue(
    value: string | pulumi.Output<string>,
    allowVariableExpansion: boolean = false,
  ): string | pulumi.Output<string> {
    function replacer(value: string): string {
      let result = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

      if (!allowVariableExpansion) {
        result = result.replaceAll('$', '\\$');
      }

      return result.replaceAll('`', '\\`').replaceAll('!', '\\!');
    }

    if (pulumi.Output.isInstance(value)) {
      return value.apply(replacer);
    }

    return replacer(value);
  }

  /**
   * Converts an environment variable map to a command-line string format
   * @param envVarMap Map of environment variable names to values
   * @returns A Pulumi Output containing the stringified environment variables
   */
  static stringifyEnvForCommand(
    envVarMap: Record<string, string | pulumi.Output<string>>,
  ): pulumi.Output<string> {
    return pulumi
      .all(
        Object.entries(envVarMap).map(
          ([name, value]) =>
            // process the env vars before the apply() call to avoid exposing secrets in resource outputs
            pulumi.interpolate`${name}="${EnvUtils.escapeBashEnvValue(value)}"`,
        ),
      )
      .apply((envArray) => envArray.join(' '));
  }

  /**
   * Converts an environment variable map to export statements for script execution
   * @param envVarMap Map of environment variable names to values
   * @returns A Pulumi Output containing the export statements, one per line
   */
  static stringifyEnvForScript(
    envVarMap: Record<string, string | pulumi.Output<string>>,
  ): pulumi.Output<string> {
    return pulumi
      .all(
        Object.entries(envVarMap).map(
          ([name, value]) =>
            // process the env vars before the apply() call to avoid exposing secrets in resource outputs
            pulumi.interpolate`export ${name}="${EnvUtils.escapeBashEnvValue(
              value,
            )}"`,
        ),
      )
      .apply((envArray) => envArray.join('\n'));
  }

  /**
   * Extracts variable names from template content using ${varName} pattern
   * @param content The template content to scan for variables
   * @returns Array of unique variable names found in the content
   */
  static extractVariableNames(content: string): string[] {
    const varPattern = /\$\{(?<varName>[^}]+)\}/g;
    const matches = content.matchAll(varPattern);
    const varNames = new Set<string>();

    for (const match of matches) {
      if (match.groups?.varName) {
        varNames.add(match.groups.varName);
      }
    }

    return Array.from(varNames);
  }
}
