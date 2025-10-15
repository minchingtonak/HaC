import { CamelCasedPropertiesDeep, SnakeCasedPropertiesDeep } from "type-fest";

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamelKeys<T>(
  obj: T,
  ignoreKeys?: string[],
): CamelCasedPropertiesDeep<T> {
  if (obj === null || obj === undefined) {
    return obj as CamelCasedPropertiesDeep<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      snakeToCamelKeys(item, ignoreKeys),
    ) as CamelCasedPropertiesDeep<T>;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = toCamelCase(key);
        // If this key should be ignored, keep the value as-is, otherwise recursively process it
        if (ignoreKeys && ignoreKeys.includes(key)) {
          result[camelKey] = obj[key];
        } else {
          result[camelKey] = snakeToCamelKeys(obj[key], ignoreKeys);
        }
      }
    }

    return result as CamelCasedPropertiesDeep<T>;
  }

  return obj as CamelCasedPropertiesDeep<T>;
}

export function camelToSnakeKeys<T>(
  obj: T,
  ignoreKeys?: string[],
): SnakeCasedPropertiesDeep<T> {
  if (obj === null || obj === undefined) {
    return obj as SnakeCasedPropertiesDeep<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      camelToSnakeKeys(item, ignoreKeys),
    ) as SnakeCasedPropertiesDeep<T>;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const snakeKey = toSnakeCase(key);
        // If this key should be ignored, keep the value as-is, otherwise recursively process it
        if (ignoreKeys && ignoreKeys.includes(key)) {
          result[snakeKey] = obj[key];
        } else {
          result[snakeKey] = camelToSnakeKeys(obj[key], ignoreKeys);
        }
      }
    }

    return result as SnakeCasedPropertiesDeep<T>;
  }

  return obj as SnakeCasedPropertiesDeep<T>;
}
