import { CamelCasedPropertiesDeep } from "type-fest";
import { z } from "zod";

export const PVE_DEFAULTS = {
  AUTH: { USERNAME: "root", INSECURE: false },
  DNS: { SERVERS: ["8.8.8.8", "1.1.1.1", "8.8.4.4"] },
  LXC_HOST: { ENABLED: true },
  HOST: { ENABLED: true },
};

const PveAuthSchema = z
  .object({
    username: z.string().default(PVE_DEFAULTS.AUTH.USERNAME),
    password: z.string().min(1),
    insecure: z.boolean().default(PVE_DEFAULTS.AUTH.INSECURE),
  })
  .strict();

const StoragePoolSchema = z
  .object({ name: z.string().min(1), path: z.string().min(1) })
  .strict();

const StorageConfigSchema = z
  .object({
    templates: z.string().min(1),
    mass: StoragePoolSchema,
    fast: StoragePoolSchema,
  })
  .strict();

const DnsSchema = z
  .object({
    domain: z.string().min(1),
    servers: z.array(z.string()).default(PVE_DEFAULTS.DNS.SERVERS),
  })
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
    enabled: z.boolean().default(PVE_DEFAULTS.HOST.ENABLED),
    node: z.string().min(1),
    endpoint: z.string().min(1),
    ip: z.string().min(1),
    auth: PveAuthSchema,
    storage: StorageConfigSchema,
    dns: DnsSchema,
    lxc: LxcConfigSchema,
    providers: ProvidersSchema,
  })
  .strict();

export type PveHostConfigToml = z.infer<typeof PveHostConfigSchema>;
export type PveHostConfig = CamelCasedPropertiesDeep<PveHostConfigToml>;
export type PveAuth = z.infer<typeof PveAuthSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type ProvidersConfig = z.infer<typeof ProvidersSchema>;
export type LxcHostsConfig = z.infer<typeof LxcHostsSchema>;
export type LxcNetworkConfig = z.infer<typeof LxcNetworkSchema>;
export type LxcConfig = z.infer<typeof LxcConfigSchema>;
