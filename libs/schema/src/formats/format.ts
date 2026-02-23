import { ParseResult } from "../result";

/**
 * Interface for pluggable content format parsers/serializers.
 * Implementations handle the conversion between raw string content
 * and structured data.
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
   * @param content - Raw string content to parse
   * @returns ParseResult with data or format error
   */
  parse(content: string): ParseResult<TRaw>;

  /**
   * Serialize structured data back to string format.
   * Optional - only needed if round-trip is required.
   * @param data - Data to serialize
   * @returns Serialized string content
   */
  stringify?(data: TRaw): string;
}
