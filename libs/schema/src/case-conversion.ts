import { CamelCasedPropertiesDeep, SnakeCasedPropertiesDeep } from "type-fest";

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
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a string from camelCase to snake_case.
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively convert object keys from snake_case to camelCase.
 *
 * @example
 * ```typescript
 * import { snakeToCamelKeys } from "@hac/schema/case-conversion";
 *
 * const input = { user_name: "john", created_at: "2024-01-01" };
 * const output = snakeToCamelKeys(input);
 * // { userName: "john", createdAt: "2024-01-01" }
 * ```
 *
 * @example
 * ```typescript
 * // Skip certain keys from recursive conversion
 * const input = { config: { env_vars: { MY_VAR: "value" } } };
 * const output = snakeToCamelKeys(input, { ignoreKeys: ["env_vars"] });
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

/**
 * Recursively convert object keys from camelCase to snake_case.
 *
 * @example
 * ```typescript
 * import { camelToSnakeKeys } from "@hac/schema/case-conversion";
 *
 * const input = { userName: "john", createdAt: "2024-01-01" };
 * const output = camelToSnakeKeys(input);
 * // { user_name: "john", created_at: "2024-01-01" }
 * ```
 *
 * @example
 * ```typescript
 * // Skip certain keys from recursive conversion
 * const input = { config: { envVars: { myVar: "value" } } };
 * const output = camelToSnakeKeys(input, { ignoreKeys: ["envVars"] });
 * // { config: { env_vars: { myVar: "value" } } }
 * ```
 */
export function camelToSnakeKeys<T>(
  obj: T,
  options?: CaseConversionOptions,
): SnakeCasedPropertiesDeep<T> {
  const ignoreKeys = options?.ignoreFields;

  if (obj === null || obj === undefined) {
    return obj as SnakeCasedPropertiesDeep<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      camelToSnakeKeys(item, options),
    ) as SnakeCasedPropertiesDeep<T>;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = toSnakeCase(key);
        // If this key should be ignored, keep the value as-is
        if (ignoreKeys && ignoreKeys.includes(key)) {
          result[snakeKey] = obj[key];
        } else {
          result[snakeKey] = camelToSnakeKeys(obj[key], options);
        }
      }
    }

    return result as SnakeCasedPropertiesDeep<T>;
  }

  return obj as SnakeCasedPropertiesDeep<T>;
}
