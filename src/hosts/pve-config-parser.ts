import { CONFIG_NAMESPACE_TEMPLATE } from "../constants";
import { ConfigParser } from "./config-parser";
import { PveHostConfigSchema, PveHostConfig } from "./schema/pve-host-config";

export const pveConfigParser: ConfigParser<PveHostConfig> = ConfigParser.create(
  "pve",
  PveHostConfigSchema,
  CONFIG_NAMESPACE_TEMPLATE,
);
