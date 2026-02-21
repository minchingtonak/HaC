import * as Handlebars from "handlebars";

/**
 * Helper that registers a Handlebars partial from block content.
 *
 * This allows defining reusable template fragments inline.
 *
 * @example
 * ```handlebars
 * {{#partial "header"}}
 *   <header>{{TITLE}}</header>
 * {{/partial}}
 *
 * {{> header}}
 * {{> header}}
 * ```
 */
export function partialHelper(
  name: string,
  options: Handlebars.HelperOptions,
): string {
  if (typeof name !== "string") {
    throw new Error(
      "partial helper requires a string name as the first argument",
    );
  }

  if (options.fn) {
    Handlebars.registerPartial(name, options.fn);
  }

  // Return empty string since this helper is used for registration, not output
  return "";
}
