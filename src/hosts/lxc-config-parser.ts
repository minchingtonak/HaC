import { CONFIG_NAMESPACE_TEMPLATE } from "../constants";
import { ConfigParser } from "./config-parser";
import {
  LxcHostConfigSchema,
  LxcHostConfigToml,
} from "./schema/lxc-host-config";

export const lxcConfigParser: ConfigParser<LxcHostConfigToml> =
  ConfigParser.create("lxc", LxcHostConfigSchema, CONFIG_NAMESPACE_TEMPLATE);
