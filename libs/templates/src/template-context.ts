import {
  CaseConversionOptions,
  DEFAULT_IGNORE_FIELDS,
  snakeToCamelKeys,
  toCamelCase,
  toSnakeCase,
} from "./case-conversion";
import { DualCaseContext } from "./dual-case-types";

/**
 * Options for configuring TemplateContext behavior.
 */
export interface TemplateContextOptions {
  /**
   * Keys to skip during case conversion when autoCamelCase is enabled.
   * Values under these keys are preserved as-is without recursive conversion.
   *
   * @default ["variables", "environment"]
   */
  ignoreFields?: string[];
}

/**
 * A type-safe container for template context data.
 *
 * Provides a fluent API for building up context data while maintaining
 * type safety. Useful for passing structured data to templates.
 *
 * When `autoCamelCase` is enabled, the context automatically provides
 * camelCase accessors for snake_case data, with values deeply converted
 * to camelCase keys.
 *
 * @typeParam TContext - The shape of the context data (snake_case keys)
 *
 * @example
 * ```typescript
 * // Basic usage without auto-casing
 * interface MyContext {
 *   name: string;
 *   count: number;
 * }
 *
 * const ctx = new TemplateContext<MyContext>()
 *   .withData({ name: "example" })
 *   .withData({ count: 42 });
 *
 * const data = ctx.get(); // { name: "example", count: 42 }
 * ```
 *
 * @example
 * ```typescript
 * // With auto-casing enabled
 * interface BaseContext {
 *   pve_config: { app_data_dir: string };
 * }
 *
 * const ctx = new TemplateContext<BaseContext>(
 *   { pve_config: { app_data_dir: "/data" } },
 *   { autoCamelCase: true }
 * );
 *
 * // Access snake_case (original)
 * ctx.get("pve_config"); // { app_data_dir: "/data" }
 *
 * // Access camelCase (auto-converted)
 * ctx.get("pveConfig"); // { appDataDir: "/data" }
 * ```
 */
export class TemplateContext<TContext extends Record<string, unknown>> {
  private data: Partial<TContext>;
  private options: TemplateContextOptions;
  private camelCache: Map<string, unknown> = new Map();

  constructor(
    initialData?: Partial<TContext>,
    options?: TemplateContextOptions,
  ) {
    this.data = initialData ?? {};
    this.options = {
      ignoreFields: options?.ignoreFields ?? [...DEFAULT_IGNORE_FIELDS],
    };
  }

  /**
   * Create a new context with additional data merged in.
   *
   * This method is immutable - it returns a new TemplateContext instance
   * rather than modifying the existing one. The new context inherits
   * the options from the current context.
   *
   * @param data - Additional data to merge into the context
   * @returns A new TemplateContext with the merged data
   */
  withData<TNewContext extends TContext = TContext>(
    data: Partial<TNewContext>,
  ): TemplateContext<TNewContext> {
    return new TemplateContext<TNewContext>(
      { ...this.data, ...data },
      this.options,
    );
  }

  /**
   * Get the context data.
   *
   * When called with no arguments, returns all data.
   * When called with keys, returns only those keys.
   *
   * If `autoCamelCase` is enabled, camelCase keys will return values
   * with deeply converted keys.
   *
   * @throws Error if a requested key is undefined
   */
  get(): Required<DualCaseContext<TContext>>;
  get<TKey extends keyof DualCaseContext<TContext>>(
    ...keys: TKey[]
  ): Pick<DualCaseContext<TContext>, TKey>;
  get<TKey extends keyof DualCaseContext<TContext>>(
    ...keys: TKey[]
  ):
    | Pick<DualCaseContext<TContext>, TKey>
    | Required<DualCaseContext<TContext>> {
    if (keys.length === 0) {
      return this.createDualCaseProxy(this.data) as Required<
        DualCaseContext<TContext>
      >;
    }

    const result: Partial<DualCaseContext<TContext>> = {};
    for (const key of keys) {
      const value = this.getValue(key as string);
      if (value === undefined) {
        throw new Error(
          `Tried to get data including undefined key: ${String(key)}`,
        );
      }
      result[key] = value as DualCaseContext<TContext>[TKey];
    }

    return result as Pick<DualCaseContext<TContext>, TKey>;
  }

  /**
   * Check if a key exists and has a defined value in the context.
   *
   * @param key - The key to check
   * @returns true if the key exists and is not undefined
   */
  has<TKey extends keyof DualCaseContext<TContext>>(key: TKey): boolean {
    return this.getValue(key as string) !== undefined;
  }

  /**
   * Internal method to get a value, handling both snake_case and camelCase keys.
   */
  private getValue(key: string): unknown {
    // key is snake_case
    if (key in this.data) {
      return this.data[key as keyof TContext];
    }

    // key is camelCase
    const snakeKey = toSnakeCase(key);
    if (snakeKey in this.data) {
      if (this.camelCache.has(key)) {
        return this.camelCache.get(key);
      }

      const conversionOptions: CaseConversionOptions = {
        ignoreFields: this.options.ignoreFields,
      };
      const converted = snakeToCamelKeys(
        this.data[snakeKey as keyof TContext],
        conversionOptions,
      );
      this.camelCache.set(key, converted);
      return converted;
    }

    return undefined;
  }

  /**
   * Creates a Proxy that provides both snake_case and camelCase access.
   */
  private createDualCaseProxy<T extends Record<string, unknown>>(data: T): T {
    return new Proxy(data, {
      get: (_target, prop: string) => {
        return this.getValue(prop);
      },
      has: (_target, prop: string) => {
        return this.getValue(prop) !== undefined;
      },
      ownKeys: (_target) => {
        const snakeKeys = Object.keys(this.data);
        const camelKeys = snakeKeys.map(toCamelCase);
        return [...new Set([...snakeKeys, ...camelKeys])];
      },
      getOwnPropertyDescriptor: (_target, prop: string) => {
        const value = this.getValue(prop);
        if (value !== undefined) {
          return { configurable: true, enumerable: true, value };
        }
        return undefined;
      },
    }) as T;
  }
}
