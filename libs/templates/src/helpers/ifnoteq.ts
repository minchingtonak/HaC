import type * as Handlebars from "handlebars";

/**
 * Helper that conditionally renders content if two values are NOT equal.
 *
 * @example
 * ```handlebars
 * {{#ifnoteq ENV "production"}}
 *   Debug mode enabled
 * {{/ifnoteq}}
 * ```
 */
export function ifnoteqHelper(
  a: unknown,
  b: unknown,
  options: Handlebars.HelperOptions,
): string {
  if (!options.data?.resolvedVariables) {
    throw new Error(
      "ifnoteq helper requires resolvedVariables in template data context",
    );
  }

  if (a !== b) {
    return options.fn(options.data.resolvedVariables, { data: options.data });
  }
  return options.inverse(options.data.resolvedVariables, {
    data: options.data,
  });
}
