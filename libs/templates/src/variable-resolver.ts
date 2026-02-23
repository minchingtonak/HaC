/**
 * Result of resolving a single variable.
 *
 * @typeParam T - The type of the resolved value (string, Promise<string>, etc.)
 */
export interface ResolvedVariable<T = string> {
  /** The resolved value */
  value: T;
  /** Whether this is a secret (affects logging, state handling) */
  isSecret?: boolean;
}

/**
 * Interface for resolving template variables from a data source.
 *
 * Implementations only need to resolve a single variable name to a value.
 * Recursive resolution of nested variable references is handled automatically
 * by the TemplateProcessor.
 *
 * @typeParam T - The type of resolved values. Use `string` for sync resolution,
 *                or `Promise<string>` / `pulumi.Output<string>` for async.
 *
 * @example
 * ```typescript
 * // Simple object-based resolver
 * const resolver = new ObjectVariableResolver({
 *   DOMAIN: "example.com",
 *   API_URL: "https://{{DOMAIN}}/api",  // Nested reference resolved automatically
 * });
 * ```
 */
export interface VariableResolver<T = string> {
  /**
   * Resolve a variable by name.
   *
   * @param variableName - The variable name to resolve (e.g., "SECRET_API_KEY")
   * @returns The resolved variable, or undefined if this variable should be
   *          skipped (e.g., it's a helper name, not a variable)
   */
  resolve(variableName: string): ResolvedVariable<T> | undefined;

  /**
   * Check if a variable name should be ignored during resolution.
   * Called before resolve() - if true, the variable is skipped entirely.
   *
   * Use this for:
   * - Built-in Handlebars keywords (@root, @first, etc.)
   * - Context paths (this.foo, ../bar)
   *
   * @param variableName - The variable name to check
   * @returns true if the variable should be ignored
   */
  shouldIgnore?(variableName: string): boolean;
}

/**
 * Simple variable resolver that resolves variables from a plain object.
 *
 * This is useful for testing or simple use cases where all variables
 * are known at compile time.
 *
 * @example
 * ```typescript
 * const resolver = new ObjectVariableResolver({
 *   NAME: "World",
 *   GREETING: "Hello, {{NAME}}!",
 * });
 *
 * const processor = new TemplateProcessor(resolver);
 * const result = processor.renderTemplateString("{{GREETING}}");
 * // Result: "Hello, World!"
 * ```
 */
export class ObjectVariableResolver implements VariableResolver<string> {
  constructor(private variables: Record<string, string>) {}

  resolve(variableName: string): ResolvedVariable<string> | undefined {
    if (this.shouldIgnore(variableName)) {
      return undefined;
    }

    const value = this.variables[variableName];
    return value !== undefined ? { value } : undefined;
  }

  shouldIgnore(variableName: string): boolean {
    return (
      variableName.startsWith("@") ||
      variableName.startsWith("this.") ||
      variableName.startsWith("../")
    );
  }
}
