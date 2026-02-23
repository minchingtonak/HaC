import type * as Handlebars from "handlebars";

import type { HandlebarsInstance } from "../handlebars-instance";

/**
 * Factory that creates the partial helper bound to a specific Handlebars instance.
 *
 * The partial helper registers a Handlebars partial from block content,
 * allowing reusable template fragments to be defined inline.
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
export function createPartialHelper(
  instance: HandlebarsInstance,
): Handlebars.HelperDelegate {
  return function partialHelper(
    name: string,
    options: Handlebars.HelperOptions,
  ): string {
    if (typeof name !== "string") {
      throw new Error(
        "partial helper requires a string name as the first argument",
      );
    }

    if (options.fn) {
      instance.registerPartial(name, options.fn);
    }

    // Return empty string since this helper is used for registration, not output
    return "";
  };
}
