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
 * Register all built-in helpers.
 */
export function registerBuiltinHelpers(): void {
  for (const [name, helper] of Object.entries(BUILTIN_HELPERS)) {
    Handlebars.registerHelper(name, helper);
  }
}
