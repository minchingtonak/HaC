import { CamelCasedPropertiesDeep } from "type-fest";

/**
 * Converts a snake_case string to camelCase at the type level.
 *
 * @example
 * ```typescript
 * type Result = SnakeToCamel<"user_name">; // "userName"
 * type Nested = SnakeToCamel<"app_data_dir">; // "appDataDir"
 * ```
 */
type SnakeToCamel<S extends string> =
  S extends `${infer P}_${infer R}` ? `${P}${Capitalize<SnakeToCamel<R>>}` : S;

/**
 * Given a snake_case context type T, produces a type that includes both:
 * - Original snake_case keys with original value types
 * - camelCase keys with deeply camelCased value types
 *
 * This allows consumers to define context types using only snake_case keys
 * while still having type-safe access to camelCase versions.
 *
 * @example
 * ```typescript
 * type BaseContext = {
 *   pve_config: PveHostConfigToml;
 *   enabled_pve_hosts: PveHostConfigToml[];
 * };
 *
 * type FullContext = DualCaseContext<BaseContext>;
 * // Equivalent to:
 * // {
 * //   pve_config: PveHostConfigToml;
 * //   enabled_pve_hosts: PveHostConfigToml[];
 * //   pveConfig: CamelCasedPropertiesDeep<PveHostConfigToml>;
 * //   enabledPveHosts: CamelCasedPropertiesDeep<PveHostConfigToml>[];
 * // }
 * ```
 */
export type DualCaseContext<T extends Record<string, unknown>> = T & {
  [K in keyof T as SnakeToCamel<K & string>]: CamelCasedPropertiesDeep<T[K]>;
};
