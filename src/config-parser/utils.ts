import * as pulumi from "@pulumi/pulumi";
import { FileParseResult, FileParseError } from "./types";

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

/**
 * Log file parse errors using Pulumi's logging system.
 */
export function logFileParseErrors(errors: FileParseError[]): void {
  errors.forEach(({ filePath, error }) => {
    switch (error.kind) {
      case "format":
        pulumi.log.warn(
          `[${filePath}] ${error.formatName} ${error.kind} error:\n${error.message}${error.cause ? ` (${error.cause})` : ""}`,
        );
        break;
      case "validation":
        pulumi.log.warn(`[${filePath}] ${error.kind} error:\n${error.message}`);
        break;
    }
  });
}
