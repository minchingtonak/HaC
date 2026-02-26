import * as pulumi from "@pulumi/pulumi";

import {
  type ResolvedVariable,
  type VariableResolver,
} from "../variable-resolver";

/**
 * Variable resolver that reads from Pulumi configuration.
 *
 * Supports:
 * - Secret variables: Names starting with `SECRET_` are resolved as secrets
 * - Namespaced variables: `namespace:VAR_NAME` syntax for cross-namespace lookup
 * - Parent namespace: `parent:VAR_NAME` syntax for accessing parent namespace
 * - ALL_CAPS convention: Only uppercase variable names are resolved
 *
 * @example
 * ```typescript
 * // Pulumi.yaml has:
 * // config:
 * //   myapp:DOMAIN: example.com
 * //   myapp:SECRET_API_KEY: (encrypted)
 *
 * const resolver = new PulumiVariableResolver(new pulumi.Config("myapp"));
 *
 * resolver.resolve("DOMAIN");           // { value: "example.com" }
 * resolver.resolve("SECRET_API_KEY");   // { value: Output<string>, isSecret: true }
 * resolver.resolve("other:VAR");        // Looks up in "other" namespace
 * ```
 */
export class PulumiVariableResolver implements VariableResolver<
  string | pulumi.Output<string>
> {
  private static readonly SECRET_VARIABLE_PREFIX = "SECRET_";
  private static readonly PARENT_NAMESPACE_PREFIX = "parent:";

  constructor(private config: pulumi.Config) {}

  resolve(
    variableName: string,
  ): ResolvedVariable<string | pulumi.Output<string>> | undefined {
    let resolvedConfig = this.config;
    let resolvedConfigKey = variableName;

    // Handle parent: prefix - look up in parent namespace
    if (
      variableName.startsWith(PulumiVariableResolver.PARENT_NAMESPACE_PREFIX)
    ) {
      const namespace = this.config.name;
      if (!namespace.includes("#")) {
        throw new Error(
          `Tried to access parent of root namespace: '${namespace}'`,
        );
      }

      resolvedConfigKey = variableName.slice(
        PulumiVariableResolver.PARENT_NAMESPACE_PREFIX.length,
      );
      const parentNamespace = namespace.slice(0, namespace.lastIndexOf("#"));
      resolvedConfig = new pulumi.Config(parentNamespace);
    }
    // Handle namespace:key syntax
    else if (variableName.includes(":")) {
      const [namespace, configVarName] = variableName.split(":");
      resolvedConfig = new pulumi.Config(namespace);
      resolvedConfigKey = configVarName;
    }

    // Only ALL_CAPS variable names are resolved as config values
    if (resolvedConfigKey.toLocaleUpperCase() !== resolvedConfigKey) {
      return undefined;
    }

    const isSecret = resolvedConfigKey
      .toLocaleUpperCase()
      .startsWith(PulumiVariableResolver.SECRET_VARIABLE_PREFIX);

    const value =
      isSecret ?
        resolvedConfig.requireSecret(resolvedConfigKey)
      : resolvedConfig.require(resolvedConfigKey);

    return { value, isSecret };
  }
}
