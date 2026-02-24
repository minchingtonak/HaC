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
import { ProvisionerSchema } from "./provisioner";

const StoragePoolSchema = z
  .object({ name: z.string().min(1), path: z.string().min(1) })
  .strict()
  .readonly();

const StorageConfigSchema = z
  .object({ mass: StoragePoolSchema, fast: StoragePoolSchema })
  .strict()
  .readonly();

const LxcAuthSchema = z.object({ password: z.string() }).strict().readonly();

const SshSchema = z
  .object({ user: z.string(), publicKey: z.string(), privateKey: z.string() })
  .strict()
  .readonly();

const PorkbunProviderSchema = z
  .object({ apiKey: z.string(), secretKey: z.string() })
  .strict()
  .readonly();

const DnsProvidersSchema = z
  .object({ porkbun: PorkbunProviderSchema.optional() })
  .strict()
  .readonly();

const ProvidersSchema = z
  .object({ dns: DnsProvidersSchema.optional() })
  .strict()
  .readonly();

const LxcHostSchema = z
  .object({
    enabled: z.boolean().default(PVE_DEFAULTS.LXC_HOST.ENABLED),
    id: z.number().int().min(1).max(255),
  })
  .strict()
  .readonly();

const LxcHostsSchema = z.record(z.string(), LxcHostSchema);

const LxcNetworkSchema = z
  .object({
    domain: z.string().min(1),
    subnet: z.string().min(1),
    gateway: z.string().min(1),
  })
  .strict()
  .readonly();

const LxcConfigSchema = z
  .object({
    appDataDir: z.string().min(1),
    hosts: LxcHostsSchema,
    network: LxcNetworkSchema,
    auth: LxcAuthSchema,
    ssh: SshSchema,
  })
  .strict()
  .readonly();

export const PveHostConfigSchema = z
  .object({
    node: z.string().min(1),
    endpoint: z.string().min(1),
    auth: PveAuthSchema,
    dns: DnsSchema.optional(),
    firewall: FirewallSchema.optional(),
    firewallRules: z.array(FirewallRuleSchema).optional(),
    files: z.array(DownloadFileSchema).optional(),
    metricsServers: z.array(MetricsServerSchema).optional(),

    // HaC custom fields
    enabled: z.boolean().default(PVE_DEFAULTS.HOST.ENABLED),
    ip: z.string().min(1),
    domain: z.string().min(1),
    ssh: SshSchema,
    lxc: LxcConfigSchema,
    storage: StorageConfigSchema,
    providers: ProvidersSchema,
    provisioners: z.array(ProvisionerSchema).optional(),
  })
  .strict()
  .readonly();

export type PveHostConfig = z.infer<typeof PveHostConfigSchema>;
