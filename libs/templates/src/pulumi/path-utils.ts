import * as path from "node:path";

/**
 * Build a sanitized name from a file path that is safe for use in resource IDs.
 *
 * - Replaces dots and path separators with dashes
 * - Handles dotfiles by prefixing with "dot-"
 * - Removes any characters that aren't alphanumeric, underscore, or dash
 *
 * @param filePath - The file path to sanitize
 * @returns A sanitized name safe for resource IDs
 */
export function pathToResourceId(filePath: string): string {
  let filename = path.basename(filePath);

  if (filename.startsWith(".")) {
    filename = `dot-${filename.substring(1)}`;
    filePath = path.join(path.dirname(filePath), filename);
  }

  return filePath
    .replaceAll(".", "-")
    .replaceAll(path.sep, "-")
    .replaceAll(/[^a-zA-Z0-9_-]/g, "");
}
