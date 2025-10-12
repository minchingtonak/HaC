import { CamelCasedPropertiesDeep } from "type-fest";

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function snakeToCamelKeys<T>(obj: T): CamelCasedPropertiesDeep<T> {
  if (obj === null || obj === undefined) {
    return obj as CamelCasedPropertiesDeep<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      snakeToCamelKeys(item),
    ) as CamelCasedPropertiesDeep<T>;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = toCamelCase(key);
        result[camelKey] = snakeToCamelKeys(obj[key]);
      }
    }

    return result as CamelCasedPropertiesDeep<T>;
  }

  return obj as CamelCasedPropertiesDeep<T>;
}
