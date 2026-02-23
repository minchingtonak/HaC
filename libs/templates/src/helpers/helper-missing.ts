import type * as Handlebars from "handlebars";

import type { HandlebarsInstance } from "../handlebars-instance";

/**
 * Factory that creates the helperMissing helper bound to a specific Handlebars instance.
 *
 * The helperMissing helper provides debug information about missing helpers.
 * When a template references an unregistered helper, this provides a helpful
 * message instead of silently failing.
 *
 * @example
 * If template contains `{{unknownHelper arg1 arg2}}`:
 * Output: `helperMissing: unknownHelper(arg1,arg2)`
 */
export function createHelperMissingHelper(
  instance: HandlebarsInstance,
): Handlebars.HelperDelegate {
  return function helperMissingHelper(
    this: unknown,
    ...args: unknown[]
  ): Handlebars.SafeString {
    const options = args[args.length - 1] as Handlebars.HelperOptions & {
      name?: string;
    };
    const helperArgs = args.slice(0, args.length - 1);

    return instance.SafeString(
      "helperMissing: " + (options.name ?? "unknown") + "(" + helperArgs + ")",
    );
  };
}
