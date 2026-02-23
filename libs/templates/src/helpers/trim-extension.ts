/**
 * Helper that removes file extensions from a filename.
 *
 * Removes everything after and including the first dot in the filename.
 * If no dot is present, returns the original value unchanged.
 *
 * @example
 * ```handlebars
 * {{trimExtension "my-host.hbs.toml"}}
 * ```
 *
 * Output: `my-host`
 */
export function trimExtensionHelper(value: string): string {
  const dotIndex = value.indexOf(".");
  return dotIndex === -1 ? value : value.substring(0, dotIndex);
}
