/**
 * A type-safe container for template context data.
 *
 * Provides a fluent API for building up context data while maintaining
 * type safety. Useful for passing structured data to templates.
 *
 * @typeParam TContext - The shape of the context data
 *
 * @example
 * ```typescript
 * interface MyContext {
 *   name: string;
 *   count: number;
 * }
 *
 * const ctx = new TemplateContext<MyContext>()
 *   .withData({ name: "example" })
 *   .withData({ count: 42 });
 *
 * // Get all data
 * const data = ctx.get(); // { name: "example", count: 42 }
 *
 * // Get specific keys
 * const { name } = ctx.get("name"); // { name: "example" }
 * ```
 */
export class TemplateContext<TContext extends Record<string, unknown>> {
  private data: Partial<TContext>;

  constructor(initialData?: Partial<TContext>) {
    this.data = initialData ?? {};
  }

  /**
   * Create a new context with additional data merged in.
   *
   * This method is immutable - it returns a new TemplateContext instance
   * rather than modifying the existing one.
   *
   * @param data - Additional data to merge into the context
   * @returns A new TemplateContext with the merged data
   */
  withData<TNewContext extends TContext = TContext>(
    data: Partial<TNewContext>,
  ): TemplateContext<TNewContext> {
    return new TemplateContext<TNewContext>({ ...this.data, ...data });
  }

  /**
   * Get the context data.
   *
   * When called with no arguments, returns all data.
   * When called with keys, returns only those keys.
   *
   * @throws Error if a requested key is undefined
   */
  get(): Required<TContext>;
  get<
    TKey extends keyof TContext,
    TFiltered extends Required<Pick<TContext, TKey>>,
  >(...keys: TKey[]): TFiltered;
  get<
    TKey extends keyof TContext,
    TFiltered extends Required<Pick<TContext, TKey>>,
  >(...keys: TKey[]): TFiltered | Required<TContext> {
    const data =
      keys.length > 0 ?
        keys.reduce((acc, curr) => {
          const data = this.data[curr];
          if (data === undefined) {
            throw new Error(
              `Tried to get data including undefined key: ${String(curr)}`,
            );
          }
          acc[curr] = data as TFiltered[TKey];
          return acc;
        }, {} as TFiltered)
      : (this.data as Required<TContext>);

    return data;
  }
}
