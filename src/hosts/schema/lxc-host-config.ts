import { z } from "zod";
import { CamelCasedPropertiesDeep } from "type-fest";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ct } from "@muhlba91/pulumi-proxmoxve";
import { FirewallLogLevel, FirewallPolicy } from "../../constants";
import { ProvisionerSchema } from "./provisioner";
import {
  LXC_DEFAULTS,
  StartupConfigSchema,
  OsConfigSchema,
  CpuConfigSchema,
  MemoryConfigSchema,
  DiskConfigSchema,
  NetworkInterfacesSchema,
  ConsoleSchema,
  FeaturesSchema,
  CloneConfigSchema,
  MountPointSchema,
  DevicePassthroughSchema,
  FirewallOptionsSchema,
  FirewallRuleSchema,
} from "./pve";
import { StackSchemaMap } from "./stack";

/**
 * @see {@link ct.ContainerArgs}
 */
export const LxcHostConfigSchema = z
  .object({
    hostname: z.string().min(1),
    description: z.string().default(LXC_DEFAULTS.DESCRIPTION),
    unprivileged: z.boolean().default(LXC_DEFAULTS.UNPRIVILEGED),
    start_on_boot: z.boolean().default(LXC_DEFAULTS.START_ON_BOOT),
    protection: z.boolean().default(LXC_DEFAULTS.PROTECTION),
    tags: z.array(z.string()).optional(),
    started: z.boolean().default(LXC_DEFAULTS.STARTED),
    startup: StartupConfigSchema.optional(),
    hook_script_file_id: z.string().optional(),
    pool_id: z.string().optional(),
    template: z.boolean().optional(),
    os: OsConfigSchema.default({
      type: LXC_DEFAULTS.OS.TYPE,
      template_file_id: LXC_DEFAULTS.OS.TEMPLATE_FILE_ID,
    }),
    cpu: CpuConfigSchema.default({
      architecture: LXC_DEFAULTS.CPU.ARCHITECTURE,
      cores: LXC_DEFAULTS.CPU.CORES,
      units: LXC_DEFAULTS.CPU.UNITS,
    }),
    memory: MemoryConfigSchema.default({
      dedicated: LXC_DEFAULTS.MEMORY.DEDICATED,
      swap: LXC_DEFAULTS.MEMORY.SWAP,
    }),
    disk: DiskConfigSchema.default({
      datastore_id: LXC_DEFAULTS.DISK.DATASTORE_ID,
      size: LXC_DEFAULTS.DISK.SIZE,
    }),
    network_interfaces: z
      .array(NetworkInterfacesSchema)
      .default([
        {
          enabled: LXC_DEFAULTS.NETWORK_INTERFACE.ENABLED,
          name: LXC_DEFAULTS.NETWORK_INTERFACE.NAME,
          bridge: LXC_DEFAULTS.NETWORK_INTERFACE.BRIDGE,
          firewall: LXC_DEFAULTS.NETWORK_INTERFACE.FIREWALL,
        },
      ]),
    console: ConsoleSchema.default({
      enabled: LXC_DEFAULTS.CONSOLE.ENABLED,
      type: LXC_DEFAULTS.CONSOLE.TYPE,
      tty_count: LXC_DEFAULTS.CONSOLE.TTY_COUNT,
    }),
    features: FeaturesSchema.default({
      fuse: LXC_DEFAULTS.FEATURES.FUSE,
      keyctl: LXC_DEFAULTS.FEATURES.KEYCTL,
      nesting: LXC_DEFAULTS.FEATURES.NESTING,
    }),
    clone: CloneConfigSchema.optional(),
    mount_points: z.array(MountPointSchema).optional(),
    device_passthroughs: z.array(DevicePassthroughSchema).optional(),
    firewall_options: FirewallOptionsSchema.default({
      enabled: LXC_DEFAULTS.FIREWALL.ENABLED,
      dhcp: LXC_DEFAULTS.FIREWALL.DHCP,
      ndp: LXC_DEFAULTS.FIREWALL.NDP,
      radv: LXC_DEFAULTS.FIREWALL.RADV,
      macfilter: LXC_DEFAULTS.FIREWALL.MACFILTER,
      ipfilter: LXC_DEFAULTS.FIREWALL.IPFILTER,
      input_policy: FirewallPolicy.DROP,
      output_policy: FirewallPolicy.ACCEPT,
      log_level_in: FirewallLogLevel.nolog,
      log_level_out: FirewallLogLevel.nolog,
    }),
    firewall_rules: z.array(FirewallRuleSchema).optional(),

    // HaC custom fields
    stacks: StackSchemaMap.optional(),
    provisioners: z.array(ProvisionerSchema).optional(),
  })
  .strict()
  .readonly();

export type LxcHostConfigToml = z.infer<typeof LxcHostConfigSchema>;
export type LxcHostConfig = CamelCasedPropertiesDeep<LxcHostConfigToml>;
