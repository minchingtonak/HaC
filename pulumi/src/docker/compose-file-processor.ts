import * as pulumi from '@pulumi/pulumi';

export class ComposeFileUtils {
  static SERVICE_DIRECTORY_FOR = (serviceName: string) =>
    `./stacks/${serviceName}`;

  private static UNSET_VARIABLE_MARKER = 'variable is not set';

  static checkForMissingVariables(args: pulumi.ResourceHookArgs) {
    const outputs = args.newOutputs as {
      stderr: string;
    };

    const missingVars = outputs.stderr
      .split('\n')
      .filter((line) =>
        line.includes(ComposeFileUtils.UNSET_VARIABLE_MARKER),
      );

    if (missingVars.length) {
      throw new Error('\n' + missingVars.join('\n'));
    }
  }
}
