import { z } from "zod";

/**
 * Discriminated union for parse/validation errors.
 */
export type ParseError =
  | { kind: "format"; message: string; formatName: string; cause?: unknown }
  | {
      kind: "validation";
      message: string;
      tree: z.core.$ZodErrorTree<unknown>;
    };

/**
 * Result type for all parsing operations.
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: ParseError };

/**
 * Format a ParseError into a human-readable string.
 */
export function formatError(error: ParseError): string {
  if (error.kind === "format") {
    return `Failed to parse ${error.formatName}: ${error.message}`;
  }
  return error.message;
}

/**
 * Create a validation ParseError from a Zod error.
 */
export function createValidationError(zodError: z.ZodError): ParseError {
  return {
    kind: "validation",
    message: z.prettifyError(zodError),
    tree: z.treeifyError(zodError),
  };
}

/**
 * Create a format ParseError.
 */
export function createFormatParseError(
  formatName: string,
  cause: unknown,
): ParseError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return { kind: "format", message, formatName, cause };
}
