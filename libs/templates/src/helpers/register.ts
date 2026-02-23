import type * as Handlebars from "handlebars";

import type { HandlebarsInstance } from "../handlebars-instance";
import { rawHelper } from "./raw";
import { ifeqHelper } from "./ifeq";
import { ifnoteqHelper } from "./ifnoteq";
import { createPartialHelper } from "./partial";
import { createHelperMissingHelper } from "./helper-missing";

export { rawHelper } from "./raw";
export { ifeqHelper } from "./ifeq";
export { ifnoteqHelper } from "./ifnoteq";
export { createPartialHelper } from "./partial";
export { createHelperMissingHelper } from "./helper-missing";

/**
 * Helper entry that defines either a simple helper function
 * or a factory that creates a helper bound to a HandlebarsInstance.
 */
export type HelperEntry =
  | { requiresInstance: false; fn: Handlebars.HelperDelegate }
  | {
      requiresInstance: true;
      factory: (instance: HandlebarsInstance) => Handlebars.HelperDelegate;
    };

/**
 * Built-in helper definitions for registration.
 *
 * Helpers that need access to the Handlebars instance (e.g., to register
 * partials or create SafeStrings) use a factory pattern. Simple helpers
 * that don't need instance access are provided directly.
 */
export const BUILTIN_HELPERS: Record<string, HelperEntry> = {
  raw: { requiresInstance: false, fn: rawHelper },
  ifeq: { requiresInstance: false, fn: ifeqHelper },
  ifnoteq: { requiresInstance: false, fn: ifnoteqHelper },
  partial: { requiresInstance: true, factory: createPartialHelper },
  helperMissing: { requiresInstance: true, factory: createHelperMissingHelper },
};
