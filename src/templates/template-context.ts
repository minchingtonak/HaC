import { z } from "zod";

export class TemplateContext<
  TShape extends z.core.$ZodShape,
  TObject extends z.ZodObject<TShape>,
  TContext extends Record<string, unknown> = z.infer<TObject>,
> {
  private schema: TObject;
  private data: Partial<TContext>;

  constructor(schema: TObject, initialData?: Partial<TContext>) {
    this.schema = schema;
    this.data = initialData ?? {};
  }

  static fromSchema<
    TShape extends z.core.$ZodShape,
    TObject extends z.ZodObject<TShape>,
  >(
    schema: TObject,
    initialData?: Partial<z.infer<TObject>>,
  ): TemplateContext<TShape, TObject> {
    return new TemplateContext<TShape, TObject>(schema, initialData);
  }

  withData<TNewContext extends TContext = TContext>(
    data: Partial<TNewContext>,
  ) {
    return new TemplateContext<TShape, TObject, TNewContext>(this.schema, {
      ...this.data,
      ...data,
    });
  }

  get(): Required<TContext>;
  get<
    TMask extends z.core.util.Mask<keyof TContext>,
    TFiltered extends z.infer<ReturnType<typeof this.schema.pick>>,
  >(mask: TMask): TFiltered;
  get<
    TMask extends z.core.util.Mask<keyof TContext>,
    TFiltered extends z.infer<ReturnType<typeof this.schema.pick>>,
  >(mask?: TMask): TFiltered {
    const schema = mask ? this.schema.pick(mask) : this.schema;

    return schema.parse(this.data) as TFiltered;
    // TODO replace with zod schema? can pass in as ctor parameter and infer types
    // const data =
    //   keys.length > 0 ?
    //     keys.reduce((acc, curr) => {
    //       const data = this.data[curr];
    //       if (data === undefined) {
    //         throw new Error(
    //           `Tried to get data including undefined key: ${String(curr)}`,
    //         );
    //       }
    //       acc[curr] = data as TFiltered[TKey];
    //       return acc;
    //     }, {} as TFiltered)
    //   : (this.data as Required<TContext>);

    // return data;
  }
}
