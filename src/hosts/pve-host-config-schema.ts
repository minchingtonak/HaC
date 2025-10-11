import { z } from "zod";

const PveAuthSchema = z
  .object({
    username: z.string().default("root"),
    password: z.string().min(1),
    insecure: z.boolean().default(false),
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
    servers: z.array(z.string()).default(["8.8.8.8", "1.1.1.1", "8.8.4.4"]),
  })
  .strict();

const LxcAuthSchema = z.object({ password: z.string() }).strict();

const LxcSshSchema = z
  .object({ publicKey: z.string(), privateKey: z.string() })
  .strict();

const PorkbunProviderSchema = z
  .object({ apiKey: z.string(), secretKey: z.string() })
  .strict();

const DnsProvidersSchema = z
  .object({ porkbun: PorkbunProviderSchema.optional() })
  .strict();

const ProvidersSchema = z
  .object({ dns: DnsProvidersSchema.optional() })
  .strict();

const LxcHostSchema = z.object({ enabled: z.boolean().default(true) }).strict();

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
    appDataDirectory: z.string().min(1),
    hosts: LxcHostsSchema,
    network: LxcNetworkSchema,
    auth: LxcAuthSchema,
    ssh: LxcSshSchema,
  })
  .strict();

export const PveHostConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
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
export type PveAuth = z.infer<typeof PveAuthSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type ProvidersConfig = z.infer<typeof ProvidersSchema>;
export type LxcHostsConfig = z.infer<typeof LxcHostsSchema>;
export type LxcNetworkConfig = z.infer<typeof LxcNetworkSchema>;
export type LxcConfig = z.infer<typeof LxcConfigSchema>;

export const PveHostnameSchema = z.object({ node: z.string().min(1) });

export type PveHostnameToml = z.infer<typeof PveHostnameSchema>;
