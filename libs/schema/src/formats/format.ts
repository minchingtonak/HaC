import { ParseResult } from "../result";

/**
 * Interface for pluggable content format parsers/serializers.
 * Implementations handle the conversion between raw string content
 * and structured data, with automatic key normalization to camelCase.
 *
 * @example
 * ```typescript
 * const toml: Format = {
 *   name: "toml",
 *   extensions: [".toml"],
 *   parse: (content) => {
 *     try {
 *       return { success: true, data: TOML.parse(content) };
 *     } catch (error) {
 *       return { success: false, error: formatParseError("toml", error) };
 *     }
 *   },
 *   normalizeKeys: (data) => snakeToCamelKeys(data),
 *   stringify: (data) => TOML.stringify(data),
 * };
 * ```
 */
export interface Format<TRaw = unknown> {
  /** Unique identifier for this format (e.g., "toml", "yaml", "json") */
  readonly name: string;

  /** File extensions associated with this format (e.g., [".toml", ".tml"]) */
  readonly extensions: readonly string[];

  /**
   * Parse raw string content into structured data.
   * Returns data with keys in the format's native style (e.g., snake_case for TOML).
   *
   * @param content - Raw string content to parse
   * @returns ParseResult with data or format error
   */
  parse(content: string): ParseResult<TRaw>;

  /**
   * Normalize keys from the format's native style to camelCase.
   * This is called after parsing to ensure consistent key casing
   * throughout the TypeScript codebase.
   *
   * @param data - Parsed data with native key style
   * @returns Data with all keys recursively converted to camelCase
   */
  normalizeKeys(data: TRaw): TRaw;

  /**
   * Serialize structured data back to string format.
   * Optional - only needed if round-trip is required.
   *
   * @param data - Data to serialize
   * @returns Serialized string content
   */
  stringify?(data: TRaw): string;
}
