import TOML from "smol-toml";

import { Format } from "./format";
import { ParseResult, createFormatParseError } from "../result";
import { snakeToCamelKeys } from "../case-conversion";

/**
 * TOML format implementation using smol-toml.
 *
 * TOML files use snake_case keys by convention. The `normalizeKeys` method
 * converts these to camelCase for use in TypeScript code.
 */
export const TomlFormat: Format<Record<string, unknown>> = {
  name: "toml",
  extensions: [".toml", ".tml"],

  parse(content: string): ParseResult<Record<string, unknown>> {
    try {
      const data = TOML.parse(content);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: createFormatParseError(this.name, error),
      };
    }
  },

  normalizeKeys(data: Record<string, unknown>): Record<string, unknown> {
    return snakeToCamelKeys(data);
  },

  stringify(data: Record<string, unknown>): string {
    return TOML.stringify(data);
  },
};
