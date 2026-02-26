import * as pulumi from "@pulumi/pulumi";

/**
 * Utility functions for handling environment variables in various contexts
 */
export class EnvUtils {
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
      let result = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

      if (!allowVariableExpansion) {
        result = result.replaceAll("$", "\\$");
      }

      return result.replaceAll("`", "\\`").replaceAll("!", "\\!");
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
      .apply((envArray) => envArray.join(" "));
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
      .apply((envArray) => envArray.join("\n"));
  }
}
