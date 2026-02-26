import { ParseError } from "@hac/schema/result";

/**
 * Parse error with file context for file-based parsing operations.
 */
export type FileParseError = {
  filePath: string;
  fileName: string;
  error: ParseError;
};

/**
 * Result type for file-based parsing operations.
 */
export type FileParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: FileParseError };
