import { CamelCasedPropertiesDeep } from "type-fest";
import { z } from "zod";
import {
  DnsSchema,
  DownloadFileSchema,
  FirewallRuleSchema,
  FirewallSchema,
  MetricsServerSchema,
  PVE_DEFAULTS,
  PveAuthSchema,
} from "./pve";

const StoragePoolSchema = z
  .object({ name: z.string().min(1), path: z.string().min(1) })
  .strict();

const StorageConfigSchema = z
  .object({ mass: StoragePoolSchema, fast: StoragePoolSchema })
  .strict();

const LxcAuthSchema = z.object({ password: z.string() }).strict();

const LxcSshSchema = z
  .object({ public_key: z.string(), private_key: z.string() })
  .strict();

const PorkbunProviderSchema = z
  .object({ api_key: z.string(), secret_key: z.string() })
  .strict();

const DnsProvidersSchema = z
  .object({ porkbun: PorkbunProviderSchema.optional() })
  .strict();

const ProvidersSchema = z
  .object({ dns: DnsProvidersSchema.optional() })
  .strict();

const LxcHostSchema = z
  .object({ enabled: z.boolean().default(PVE_DEFAULTS.LXC_HOST.ENABLED) })
  .strict();

const LxcHostsSchema = z.record(z.string(), LxcHostSchema);

const LxcNetworkSchema = z
  .object({
    domain: z.string().min(1),
    subnet: z.string().min(1),
    gateway: z.string().min(1),
  })
  .strict();

const LxcConfigSchema = z
  .object({
    app_data_dir: z.string().min(1),
    hosts: LxcHostsSchema,
    network: LxcNetworkSchema,
    auth: LxcAuthSchema,
    ssh: LxcSshSchema,
  })
  .strict();

export const PveHostConfigSchema = z
  .object({
    node: z.string().min(1),
    endpoint: z.string().min(1),
    auth: PveAuthSchema,
    dns: DnsSchema.optional(),
    firewall: FirewallSchema.optional(),
    firewall_rules: z.array(FirewallRuleSchema).optional(),
    files: z.array(DownloadFileSchema).optional(),
    metrics_servers: z.array(MetricsServerSchema).optional(),

    // HaC custom fields
    enabled: z.boolean().default(PVE_DEFAULTS.HOST.ENABLED),
    ip: z.string().min(1),
    lxc: LxcConfigSchema,
    storage: StorageConfigSchema,
    providers: ProvidersSchema,
  })
  .strict();

export type PveHostConfigToml = z.infer<typeof PveHostConfigSchema>;
export type PveHostConfig = CamelCasedPropertiesDeep<PveHostConfigToml>;
