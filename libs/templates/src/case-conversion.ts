import { CamelCasedPropertiesDeep } from "type-fest";

/**
 * Default fields to ignore during case conversion.
 * Values under these keys are preserved as-is without recursive conversion.
 */
export const DEFAULT_IGNORE_FIELDS: readonly string[] = [
  "variables",
  "environment",
] as const;

/**
 * Options for case conversion functions.
 */
export interface CaseConversionOptions {
  /**
   * Keys to skip during recursive conversion.
   * The values under these keys are kept as-is without recursive conversion.
   */
  ignoreFields?: string[];
}

/**
 * Convert a string from snake_case to camelCase.
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a string from camelCase to snake_case.
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert object keys from snake_case to camelCase.
 *
 * @example
 * ```typescript
 * const input = { user_name: "john", created_at: "2024-01-01" };
 * const output = snakeToCamelKeys(input);
 * // { userName: "john", createdAt: "2024-01-01" }
 * ```
 *
 * @example
 * ```typescript
 * // Skip certain keys from recursive conversion
 * const input = { config: { env_vars: { MY_VAR: "value" } } };
 * const output = snakeToCamelKeys(input, { ignoreFields: ["env_vars"] });
 * // { config: { envVars: { MY_VAR: "value" } } }
 * ```
 */
export function snakeToCamelKeys<T>(
  obj: T,
  options?: CaseConversionOptions,
): CamelCasedPropertiesDeep<T> {
  const ignoreKeys = options?.ignoreFields;

  if (obj === null || obj === undefined) {
    return obj as CamelCasedPropertiesDeep<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      snakeToCamelKeys(item, options),
    ) as CamelCasedPropertiesDeep<T>;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = toCamelCase(key);
        // If this key should be ignored, keep the value as-is
        if (ignoreKeys && ignoreKeys.includes(key)) {
          result[camelKey] = obj[key];
        } else {
          result[camelKey] = snakeToCamelKeys(obj[key], options);
        }
      }
    }

    return result as CamelCasedPropertiesDeep<T>;
  }

  return obj as CamelCasedPropertiesDeep<T>;
}
