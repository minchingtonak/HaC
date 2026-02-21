import type * as Handlebars from "handlebars";

/**
 * Helper that renders its block content without variable substitution.
 *
 * Useful for including literal Handlebars syntax in the output
 * (e.g., for generating other templates).
 *
 * @example
 * ```handlebars
 * {{#raw}}
 *   This {{variable}} will not be substituted
 * {{/raw}}
 * ```
 *
 * Output: `This {{variable}} will not be substituted`
 */
export function rawHelper(options: Handlebars.HelperOptions): string {
  // Render with an empty context to prevent variable substitution
  return options.fn({});
}
