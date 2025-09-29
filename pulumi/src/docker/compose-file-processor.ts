import * as pulumi from '@pulumi/pulumi';

export class ComposeStackUtils {
  static STACK_DIRECTORY_FOR = (stackName: string) =>
    `./hosts/stacks/${stackName}`;

  private static UNSET_VARIABLE_MARKER = 'variable is not set';

  static checkForMissingVariables(args: pulumi.ResourceHookArgs) {
    const outputs = args.newOutputs as {
      stderr: string;
    };

    const missingVars = outputs.stderr
      .split('\n')
      .filter((line) => line.includes(ComposeStackUtils.UNSET_VARIABLE_MARKER));

    if (missingVars.length) {
      throw new Error('\n' + missingVars.join('\n'));
    }
  }
}
