import type { ParseError } from "./result";

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

/**
 * Partition an array of FileParseResults into successes and failures.
 */
export function partitionFileParseResults<T>(
  results: FileParseResult<T>[],
): readonly [T[], FileParseError[]] {
  const successes: T[] = [];
  const failures: FileParseError[] = [];

  for (const result of results) {
    if (result.success) {
      successes.push(result.data);
    } else {
      failures.push(result.error);
    }
  }

  return [successes, failures] as const;
}
