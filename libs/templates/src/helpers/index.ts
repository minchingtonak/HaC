import * as Handlebars from "handlebars";

import { rawHelper } from "./raw";
import { ifeqHelper } from "./ifeq";
import { ifnoteqHelper } from "./ifnoteq";
import { partialHelper } from "./partial";
import { helperMissingHelper } from "./helper-missing";

export { rawHelper } from "./raw";
export { ifeqHelper } from "./ifeq";
export { ifnoteqHelper } from "./ifnoteq";
export { partialHelper } from "./partial";
export { helperMissingHelper } from "./helper-missing";

/**
 * Built-in helper definitions for registration.
 */
export const BUILTIN_HELPERS = {
  raw: rawHelper,
  ifeq: ifeqHelper,
  ifnoteq: ifnoteqHelper,
  partial: partialHelper,
  helperMissing: helperMissingHelper,
} as const;

/**
 * Register all built-in Handlebars helpers.
 *
 * This registers:
 * - `raw` - Render content without variable substitution
 * - `ifeq` - Conditional block if values are equal
 * - `ifnoteq` - Conditional block if values are not equal
 * - `partial` - Register inline partials
 * - `helperMissing` - Debug output for missing helpers
 *
 * @param onHelperRegistered - Optional callback for each registered helper name
 * @returns A function to unregister all helpers
 *
 * @example
 * ```typescript
 * import { registerBuiltinHelpers } from "@hac/templates";
 *
 * const unregister = registerBuiltinHelpers();
 *
 * // Later, to clean up:
 * unregister();
 * ```
 */
export function registerBuiltinHelpers(
  onHelperRegistered?: (name: string) => void,
): () => void {
  const registeredNames: string[] = [];

  for (const [name, helper] of Object.entries(BUILTIN_HELPERS)) {
    Handlebars.registerHelper(name, helper);
    registeredNames.push(name);
    onHelperRegistered?.(name);
  }

  return () => {
    for (const name of registeredNames) {
      Handlebars.unregisterHelper(name);
    }
  };
}
