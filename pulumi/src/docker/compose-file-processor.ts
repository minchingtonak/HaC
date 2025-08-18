import * as pulumi from '@pulumi/pulumi';
import * as fs from 'node:fs';

export class ComposeFileProcessor {
  static SERVICE_DIRECTORY_FOR = (serviceName: string) =>
    `./stacks/${serviceName}`;

  static COMPOSE_FILE_FOR = (serviceName: string) =>
    `${ComposeFileProcessor.SERVICE_DIRECTORY_FOR(serviceName)}/compose.yaml`;

  static getStringifiedEnvVarsForService(serviceName: string) {
    const env = ComposeFileProcessor.assembleVariableMap(serviceName);
    return ComposeFileProcessor.stringifyEnvForCommand(env);
  }

  private static SECRET_VARIABLE_PREFIX = 'SECRET_';

  private static assembleVariableMap(
    serviceName: string,
  ): Record<string, string | pulumi.Output<string>> {
    const serviceConfig = new pulumi.Config(serviceName);
    const fileContent = fs.readFileSync(
      ComposeFileProcessor.COMPOSE_FILE_FOR(serviceName),
      { encoding: 'utf-8' },
    );

    const varPattern = /\$\{(?<varName>[^}]+)\}/g;
    const matches = fileContent.matchAll(varPattern);

    const serviceEnv: Record<string, string | pulumi.Output<string>> = {};

    for (const match of matches) {
      if (!match.groups) {
        continue;
      }

      const varName = match.groups.varName;
      if (
        varName
          .toLocaleUpperCase()
          .startsWith(ComposeFileProcessor.SECRET_VARIABLE_PREFIX)
      ) {
        serviceEnv[varName] = serviceConfig.requireSecret(varName);
      } else {
        serviceEnv[varName] = serviceConfig.require(varName);
      }
    }

    return serviceEnv;
  }

  private static stringifyEnvForCommand(
    envVarMap: Record<string, string | pulumi.Output<string>>,
  ) {
    return pulumi
      .all(
        Object.entries(envVarMap).map(
          ([name, value]) =>
            // process the env vars before the apply() call to avoid exposing secrets in resource outputs
            pulumi.interpolate`${name}="${ComposeFileProcessor.escapeBashEnvValue(
              value,
            )}"`,
        ),
      )
      .apply((envArray) => envArray.join(' '));
  }

  private static escapeBashEnvValue(
    value: string | pulumi.Output<string>,
    allowVariableExpansion: boolean = false,
  ) {
    function replacer(value: string) {
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

  private static UNSET_VARIABLE_MARKER = 'variable is not set';

  static checkForMissingVariables(args: pulumi.ResourceHookArgs) {
    const outputs = args.newOutputs as {
      stderr: string;
    };

    const missingVars = outputs.stderr
      .split('\n')
      .filter((line) =>
        line.includes(ComposeFileProcessor.UNSET_VARIABLE_MARKER),
      );

    if (missingVars.length) {
      throw new Error('\n' + missingVars.join('\n'));
    }
  }
}
