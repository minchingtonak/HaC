import { z } from "zod";

/**
 * schema-based context
 *
 * user gives schema when creating context
 * user must give additional schema when adding new data via withData
 * get() will grab each member schema from the schema object and validate
 * getValidated() will need to vend a proxy that does validation by using the schema against gets to the object
 * - how can it look up the correct schema to validate against?
 * - i think we can look up the schema outside the proxy, and reference in the get() trap
 * - will need to modify deepCreateProxy to iterate through schema as well
 * withOverride() can validate the given overrides against the picked schema
 * - will need to ensure creation of new proxies
 * - can possibly simplify using cloneDeep
 *    - withOverride can clone the context via cloneDeep, then overrrite the fields on the cloned context
 *    - finally, can pass to createDeepProxy to re-proxy the object
 */

export class TemplateContext<
  TShape extends z.core.$ZodShape,
  TSchema extends z.ZodObject<TShape, z.core.$strict>,
  TContext = z.infer<TSchema>,
> {
  private readonly schema: TSchema;
  private data: TContext;

  constructor(schema: TSchema, initialData: TContext) {
    this.schema = schema;
    this.data = initialData;

    this.schema.parse(this.data);
  }

  get(): TContext;
  get<TKey extends keyof TContext, TFiltered extends Pick<TContext, TKey>>(
    ...keys: TKey[]
  ): TFiltered;
  get<TKey extends keyof TContext, TFiltered extends Pick<TContext, TKey>>(
    ...keys: TKey[]
  ): TContext | TFiltered {
    if (keys.length === 0) {
      return this.data;
    }

    return keys.reduce(
      (acc, curr) => ((acc[curr] = this.data[curr]), acc),
      {} as Record<TKey, TContext[TKey]>,
    ) as TFiltered;
  }

  withData<
    TNewShape extends z.core.$ZodShape,
    TNewSchema extends z.ZodObject<TNewShape>,
  >(newSchema: TNewSchema, newData: z.infer<TNewSchema>) {
    const extendedSchema = z
      .object({ ...this.schema.shape, ...newSchema.shape })
      .strict();
    const extendedData = { ...this.data, ...newData } as z.infer<
      typeof extendedSchema
    >;

    return new TemplateContext(extendedSchema, extendedData);
  }

  // static withOverride<TContext extends Record<string, unknown>>(
  //   context: TContext,
  //   overrides: DeepPartial<TContext>,
  // ): TContext {
  //   if (overrides) {
  //     console.log("GRAVY template-context.ts:24 -", overrides);
  //   }
  //   const result = { ...context };

  //   function isObject(value: unknown): value is Record<string, unknown> {
  //     return (
  //       value !== null && typeof value === "object" && !Array.isArray(value)
  //     );
  //   }

  //   for (const key in overrides) {
  //     if (Object.prototype.hasOwnProperty.call(overrides, key)) {
  //       const contextValue = context[key as keyof TContext];
  //       const overrideValue = overrides[key as keyof typeof overrides];

  //       if (overrideValue === undefined) {
  //         continue;
  //       }

  //       if (isObject(contextValue) && isObject(overrideValue)) {
  //         result[key as keyof TContext] = TemplateContext.withOverride(
  //           contextValue,
  //           overrideValue as DeepPartial<
  //             TContext[keyof TContext] & Record<string, unknown>
  //           >,
  //         );
  //       } else {
  //         result[key as keyof TContext] =
  //           overrideValue as TContext[keyof TContext];
  //       }
  //     }
  //   }

  //   return result;
  // }

  // getValidated(): Required<TContext>;
  // getValidated<
  //   TKey extends keyof TContext,
  //   TFiltered extends Required<Pick<TContext, TKey>>,
  // >(...keys: TKey[]): TFiltered;
  // getValidated<
  //   TKey extends keyof TContext,
  //   TFiltered extends Required<Pick<TContext, TKey>>,
  // >(...keys: TKey[]): TFiltered | Required<TContext> {
  //   const data = keys.length > 0 ? this.get(...keys) : this.get();
  //   return TemplateContext.createDeepProxy(data) as
  //     | TFiltered
  //     | Required<TContext>;
  // }

  // private static createDeepProxy<T>(data: T): T {
  //   if (data === null || typeof data !== "object") {
  //     return data;
  //   }

  //   if (Array.isArray(data)) {
  //     return data.map((item) => TemplateContext.createDeepProxy(item)) as T;
  //   }

  //   const proxiedData = Object.entries(data as Record<string, unknown>).reduce(
  //     (acc, [key, value]) => {
  //       acc[key] = TemplateContext.createDeepProxy(value);
  //       return acc;
  //     },
  //     {} as Record<string, unknown>,
  //   );

  //   return new Proxy(proxiedData as object, {
  //     get(target, property, receiver) {
  //       // call the object's internal get method
  //       const value = Reflect.get(target, property, receiver);
  //       if (typeof property === "symbol") {
  //         return value;
  //       }

  //       if (value === undefined || value === null) {
  //         throw new Error(
  //           `Tried to access undefined/null context data: ${String(property)}, ${JSON.stringify(
  //             target,
  //             (_k, v) => {
  //               if (v === undefined) return "undefined";

  //               return v;
  //             },
  //           )}`,
  //         );
  //       }

  //       if (typeof value === "string" && value.length === 0) {
  //         pulumi.log.warn(
  //           `Context data with property ${String(property)} is an empty string`,
  //         );
  //       }

  //       return value;
  //     },
  //   }) as T;
  // }
}
