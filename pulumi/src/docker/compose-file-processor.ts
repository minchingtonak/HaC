import * as pulumi from '@pulumi/pulumi';
import { EnvUtils } from '../utils/env-utils';

export class ComposeFileProcessor {
  static SERVICE_DIRECTORY_FOR = (serviceName: string) =>
    `./stacks/${serviceName}`;

  static COMPOSE_FILE_FOR = (serviceName: string) =>
    `${ComposeFileProcessor.SERVICE_DIRECTORY_FOR(serviceName)}/compose.yaml`;

  static getStringifiedEnvVarsForService(
    serviceName: string,
    hostname?: string,
  ) {
    const serviceConfig = new pulumi.Config(
      hostname ? `${hostname}#${serviceName}` : serviceName,
    );
    const composeFilePath = ComposeFileProcessor.COMPOSE_FILE_FOR(serviceName);
    return EnvUtils.getStringifiedEnvVarsFromFile(
      composeFilePath,
      serviceConfig,
    );
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
