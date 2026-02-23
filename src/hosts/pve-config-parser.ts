import { CONFIG_NAMESPACE_TEMPLATE } from "../constants";
import { ConfigParser } from "./config-parser";
import {
  PveHostConfigSchema,
  PveHostConfigToml,
} from "./schema/pve-host-config";

export const pveConfigParser: ConfigParser<PveHostConfigToml> =
  ConfigParser.create("pve", PveHostConfigSchema, CONFIG_NAMESPACE_TEMPLATE);
