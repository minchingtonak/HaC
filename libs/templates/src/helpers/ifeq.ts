import type * as Handlebars from "handlebars";

/**
 * Helper that conditionally renders content if two values are equal.
 *
 * @example
 * ```handlebars
 * {{#ifeq ENV "production"}}
 *   Production config here
 * {{else}}
 *   Development config here
 * {{/ifeq}}
 * ```
 */
export function ifeqHelper(
  a: unknown,
  b: unknown,
  options: Handlebars.HelperOptions,
): string {
  if (!options.data?.resolvedVariables) {
    throw new Error(
      "ifeq helper requires resolvedVariables in template data context",
    );
  }

  if (a === b) {
    return options.fn(options.data.resolvedVariables, { data: options.data });
  }
  return options.inverse(options.data.resolvedVariables, {
    data: options.data,
  });
}
