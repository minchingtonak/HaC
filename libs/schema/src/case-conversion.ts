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
 */
export function snakeToCamelKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamelKeys(item)) as T;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = toCamelCase(key);
        result[camelKey] = snakeToCamelKeys(obj[key as keyof typeof obj]);
      }
    }

    return result as T;
  }

  return obj;
}

/**
 * Recursively convert object keys from camelCase to snake_case.
 *
 * @example
 * ```typescript
 * const input = { userName: "john", createdAt: "2024-01-01" };
 * const output = camelToSnakeKeys(input);
 * // { user_name: "john", created_at: "2024-01-01" }
 * ```
 */
export function camelToSnakeKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnakeKeys(item)) as T;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = toSnakeCase(key);
        result[snakeKey] = camelToSnakeKeys(obj[key as keyof typeof obj]);
      }
    }

    return result as T;
  }

  return obj;
}
