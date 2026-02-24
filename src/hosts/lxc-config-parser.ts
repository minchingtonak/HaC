import { CONFIG_NAMESPACE_TEMPLATE } from "../constants";
import { ConfigParser } from "./config-parser";
import { LxcHostConfigSchema, LxcHostConfig } from "./schema/lxc-host-config";

export const lxcConfigParser: ConfigParser<LxcHostConfig> = ConfigParser.create(
  "lxc",
  LxcHostConfigSchema,
  CONFIG_NAMESPACE_TEMPLATE,
);
