export class TemplateContext<TContext extends Record<string, unknown>> {
  private data: Partial<TContext>;

  constructor(initialData?: Partial<TContext>) {
    this.data = initialData ?? {};
  }

  withData<TNewContext extends TContext = TContext>(
    data: Partial<TNewContext>,
  ) {
    return new TemplateContext<TNewContext>({ ...this.data, ...data });
  }

  get(): Required<TContext>;
  get<
    TKey extends keyof TContext,
    TFiltered extends Required<Pick<TContext, TKey>>,
  >(...keys: TKey[]): TFiltered;
  get<
    TKey extends keyof TContext,
    TFiltered extends Required<Pick<TContext, TKey>>,
  >(...keys: TKey[]): TFiltered | Required<TContext> {
    // TODO replace with zod schema? can pass in as ctor parameter and infer types
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
        // TODO fix issue where incomplete data can be returned as is typed as complete
        // can use schema to validate
      : (this.data as Required<TContext>);

    return data;
  }
}
