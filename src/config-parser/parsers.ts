import {
  LxcHostConfig,
  LxcHostConfigSchema,
} from "../config-schema/lxc-host-config";
import {
  PveHostConfig,
  PveHostConfigSchema,
} from "../config-schema/pve-host-config";
import { ConfigParser } from "./config-parser";

const CONFIG_NAMESPACE_TEMPLATE =
  "{{{parserType}}}#{{{trimExtension fileName}}}";

export const pveConfigParser: ConfigParser<PveHostConfig> = ConfigParser.create(
  "pve",
  PveHostConfigSchema,
  CONFIG_NAMESPACE_TEMPLATE,
);

export const lxcConfigParser: ConfigParser<LxcHostConfig> = ConfigParser.create(
  "lxc",
  LxcHostConfigSchema,
  CONFIG_NAMESPACE_TEMPLATE,
);
