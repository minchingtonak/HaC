import * as pulumi from "@pulumi/pulumi";
import { z } from "zod";

import { Format } from "../formats/format";
import { TomlFormat } from "../formats/toml";
import { SchemaParserOptions } from "../schema-parser-options";
import { ParseResult, createValidationError } from "../result";

/**
 * Pulumi-aware schema parser that handles Output<string> content.
 * Returns ParseResult types for exception-free error handling.
 *
 * The parsing flow is:
 * 1. Format.parse() - Parse raw content to native format (e.g., TOML with snake_case)
 * 2. Format.normalizeKeys() - Convert keys to camelCase for TypeScript
 * 3. Schema.validate() - Validate against Zod schema
 *
 * @example
 * ```typescript
 * import { PulumiSchemaParser } from "@hac/schema/pulumi/parser";
 *
 * const MyConfigSchema = z.object({
 *   hostname: z.string(),
 *   port: z.number(),
 * }).strict().readonly();
 *
 * const parser = new PulumiSchemaParser(MyConfigSchema);
 *
 * // Parse Pulumi Output content
 * const resultOutput = parser.parse(templateOutput);
 * resultOutput.apply((result) => {
 *   if (result.success) {
 *     // result.data is typed
 *   } else {
 *     console.error(result.error.message);
 *   }
 * });
 *
 * // Or parse sync content
 * const result = parser.parseSync(tomlString);
 * if (result.success) {
 *   // result.data is typed
 * }
 * ```
 */
export class PulumiSchemaParser<TSchema extends z.ZodSchema> {
  private readonly defaultFormat: Format;

  constructor(
    private readonly schema: TSchema,
    options?: SchemaParserOptions,
  ) {
    this.defaultFormat = options?.defaultFormat ?? TomlFormat;
  }

  /**
   * Parse Pulumi Output content and validate against schema.
   *
   * @param content - Pulumi Output containing raw string content
   * @param format - Format implementation (defaults to constructor option or TOML)
   * @returns Pulumi Output containing ParseResult
   */
  parse(
    content: pulumi.Output<string>,
    format?: Format,
  ): pulumi.Output<ParseResult<z.infer<TSchema>>> {
    const resolvedFormat = format ?? this.defaultFormat;
    return content.apply((c) => this.parseSync(c, resolvedFormat));
  }

  /**
   * Parse plain string content synchronously.
   *
   * @param content - Raw string content to parse
   * @param format - Format implementation (defaults to constructor option or TOML)
   * @returns ParseResult with validated data or error
   */
  parseSync(content: string, format?: Format): ParseResult<z.infer<TSchema>> {
    const resolvedFormat = format ?? this.defaultFormat;

    const formatResult = resolvedFormat.parse(content);
    if (!formatResult.success) {
      return formatResult;
    }

    const normalizedData = resolvedFormat.normalizeKeys(formatResult.data);

    return this.validateSync(normalizedData);
  }

  /**
   * Validate Pulumi Output data against the schema.
   *
   * @param data - Pulumi Output containing untyped data to validate
   * @returns Pulumi Output containing ParseResult
   */
  validate(
    data: pulumi.Output<unknown>,
  ): pulumi.Output<ParseResult<z.infer<TSchema>>> {
    return data.apply((d) => this.validateSync(d));
  }

  /**
   * Validate data synchronously.
   *
   * @param data - Untyped data to validate
   * @returns ParseResult with validated data or error
   */
  validateSync(data: unknown): ParseResult<z.infer<TSchema>> {
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
