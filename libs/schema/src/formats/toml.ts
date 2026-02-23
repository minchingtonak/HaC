import TOML from "smol-toml";

import { Format } from "./format";
import { ParseResult, createFormatParseError } from "../result";

/**
 * TOML format implementation using smol-toml.
 */
export const TomlFormat: Format<Record<string, unknown>> = {
  name: "toml",
  extensions: [".toml", ".tml"],

  parse(content: string): ParseResult<Record<string, unknown>> {
    try {
      return { success: true, data: TOML.parse(content) };
    } catch (error) {
      return {
        success: false,
        error: createFormatParseError(this.name, error),
      };
    }
  },

  stringify(data: Record<string, unknown>): string {
    return TOML.stringify(data);
  },
};
