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

  private ignoredVariables = new Set<string>();

  constructor(private config: pulumi.Config) {}

  resolve(
    variableName: string,
  ): ResolvedVariable<string | pulumi.Output<string>> | undefined {
    if (this.shouldIgnore(variableName)) {
      return undefined;
    }

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

    try {
      const value =
        isSecret ?
          resolvedConfig.requireSecret(resolvedConfigKey)
        : resolvedConfig.require(resolvedConfigKey);

      return { value, isSecret };
    } catch {
      // Variable not found in config - return undefined to skip
      return undefined;
    }
  }

  shouldIgnore(variableName: string): boolean {
    return (
      this.ignoredVariables.has(variableName) ||
      variableName.startsWith("@") ||
      variableName.startsWith("this.") ||
      variableName.startsWith("../")
    );
  }

  onHelperRegistered(helperName: string): void {
    this.ignoredVariables.add(helperName);
  }

  onHelperUnregistered(helperName: string): void {
    this.ignoredVariables.delete(helperName);
  }

  /**
   * Add a variable name to the ignore list.
   *
   * Ignored variables are skipped during resolution, which is useful
   * for template helpers or context variables.
   */
  addIgnoredVariable(name: string): void {
    this.ignoredVariables.add(name);
  }

  /**
   * Remove a variable name from the ignore list.
   */
  removeIgnoredVariable(name: string): boolean {
    return this.ignoredVariables.delete(name);
  }

  /**
   * Get the underlying Pulumi config namespace.
   */
  get namespace(): string {
    return this.config.name;
  }
}
