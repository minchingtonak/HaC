import { z } from "zod";

const PveAuthSchema = z
  .object({
    username: z.string().default("root"),
    password: z.string(),
    insecure: z.boolean().default(false),
  })
  .strict();

const PveConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    endpoint: z.string().min(1),
    node: z.string().min(1),
    auth: PveAuthSchema,
  })
  .strict();

const StoragePoolsConfigSchema = z
  .object({ mass: z.string().min(1), fast: z.string().min(1) })
  .strict();

const StorageConfigSchema = z
  .object({
    templates: z.string().min(1),
    containers: z.string().optional(),
    backups: z.string().optional(),
    pools: StoragePoolsConfigSchema,
  })
  .strict();

const NetworkDnsSchema = z
  .object({
    domain: z.string().min(1),
    servers: z
      .array(z.string())
      .optional()
      .default(["8.8.8.8", "1.1.1.1", "8.8.4.4"]),
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
    gateway: z.string().min(1).optional(),
  })
  .strict();

const LxcConfigSchema = z
  .object({
    appdata: z.string().min(1),
    hosts: LxcHostsSchema,
    network: LxcNetworkSchema,
    auth: LxcAuthSchema,
    ssh: LxcSshSchema,
    dns: DnsProvidersSchema.optional(),
  })
  .strict();

export const PveHostConfigSchema = z
  .object({
    pve: PveConfigSchema,
    storage: StorageConfigSchema,
    dns: NetworkDnsSchema,
    lxc: LxcConfigSchema,
    providers: ProvidersSchema.optional(),
  })
  .strict();

export type PveHostConfigToml = z.infer<typeof PveHostConfigSchema>;
export type PveAuth = z.infer<typeof PveAuthSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type ProvidersConfig = z.infer<typeof ProvidersSchema>;
export type LxcHostsConfig = z.infer<typeof LxcHostsSchema>;
export type LxcNetworkConfig = z.infer<typeof LxcNetworkSchema>;
export type LxcConfig = z.infer<typeof LxcConfigSchema>;

export const PveHostnameSchema = z.object({
  pve: z.object({ node: z.string().min(1) }),
});

export type PveHostnameToml = z.infer<typeof PveHostnameSchema>;
