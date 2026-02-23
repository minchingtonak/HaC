import { Format } from "./formats/format";

/**
 * Configuration options for SchemaParser.
 */
export interface SchemaParserOptions {
  /**
   * Default format to use when parsing content.
   * If not specified, defaults to TOML.
   */
  defaultFormat?: Format;
}
