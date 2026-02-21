import { Handlebars } from "@hac/templates/pulumi";

/**
 * Set of registered helper names, used by variable resolvers to ignore
 * helper names during variable resolution.
 */
export const registeredHelperNames = new Set<string>();

/**
 * Register a custom Handlebars helper and track its name.
 *
 * @param name - The helper name
 * @param fn - The helper function
 * @returns A function to unregister the helper
 */
export function registerTemplateHelper(
  name: string,
  fn: Handlebars.HelperDelegate,
): () => void {
  Handlebars.registerHelper(name, fn);
  registeredHelperNames.add(name);

  return () => {
    registeredHelperNames.delete(name);
    Handlebars.unregisterHelper(name);
  };
}
