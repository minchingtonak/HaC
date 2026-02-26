import { z } from "zod";

import { Format } from "./formats/format";
import { TomlFormat } from "./formats/toml";
import { SchemaParserOptions } from "./schema-parser-options";
import { ParseResult, createValidationError } from "./result";

/**
 * Generic schema parser that validates content against a Zod schema.
 * Decouples deserialization (Format) from validation (Zod).
 *
 * The parsing flow is:
 * 1. Format.parse() - Parse raw content to native format (e.g., TOML with snake_case)
 * 2. Format.normalizeKeys() - Convert keys to camelCase for TypeScript
 * 3. Schema.validate() - Validate against Zod schema
 *
 * @example
 * ```typescript
 * import { SchemaParser } from "@hac/schema/parser";
 * import { TomlFormat } from "@hac/schema/formats/toml";
 *
 * const MyConfigSchema = z.object({
 *   hostname: z.string(),
 *   port: z.number(),
 * }).strict().readonly();
 *
 * const parser = new SchemaParser(MyConfigSchema);
 *
 * const result = parser.parse(tomlContent);
 * if (result.success) {
 *   // result.data is typed as { hostname: string; port: number }
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export class SchemaParser<TSchema extends z.ZodSchema> {
  private readonly defaultFormat: Format;

  constructor(
    private readonly schema: TSchema,
    private readonly options?: SchemaParserOptions,
  ) {
    this.defaultFormat = options?.defaultFormat ?? TomlFormat;
  }

  /**
   * Parse content string using the specified format and validate against schema.
   *
   * @param content - Raw string content to parse
   * @param format - Format implementation (defaults to constructor option or TOML)
   * @returns ParseResult with validated data or error
   */
  parse(content: string, format?: Format): ParseResult<z.infer<TSchema>> {
    const resolvedFormat = format ?? this.defaultFormat;

    const formatResult = resolvedFormat.parse(content);
    if (!formatResult.success) {
      return formatResult;
    }

    const normalizedData = resolvedFormat.normalizeKeys(formatResult.data);

    return this.validate(normalizedData);
  }

  /**
   * Validate already-parsed data against the schema.
   *
   * @param data - Untyped data to validate
   * @returns ParseResult with validated data or error
   */
  validate(data: unknown): ParseResult<z.infer<TSchema>> {
    const result = this.schema.safeParse(data);
    if (!result.success) {
      return { success: false, error: createValidationError(result.error) };
    }
    return { success: true, data: result.data };
  }

  /**
   * Get the underlying Zod schema.
   * Useful for schema composition or direct validation.
   */
  getSchema(): TSchema {
    return this.schema;
  }
}
