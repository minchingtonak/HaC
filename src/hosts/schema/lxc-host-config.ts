import { z } from "zod";
import {
  CpuCores,
  DiskSize,
  MemorySize,
  PveFirewallDirection,
  PveFirewallLogLevel,
  PveFirewallMacro,
  PveFirewallPolicy,
  CommonPorts,
} from "../../constants";
import { CamelCasedPropertiesDeep } from "type-fest";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { remote } from "@pulumi/command/types/input";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { types, network, ct } from "@muhlba91/pulumi-proxmoxve";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { PlaybookArgs } from "@pulumi/ansible";

export const LXC_DEFAULTS = {
  DATASTORE_ID: "fast",
  NETWORK_BRIDGE: "vmbr0",
  SSH_USER: "root",
  SSH_PORT: CommonPorts.SSH,
  SSH_PRIVATE_KEY_FILE: "~/.ssh/lxc_ed25519",
  DESCRIPTION: "managed by pulumi",
  UNPRIVILEGED: true,
  START_ON_BOOT: true,
  STARTED: true,
  PROTECTION: false,
  OS: {
    TYPE: "debian",
    TEMPLATE_FILE_ID: "local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst",
  },
  CPU: { ARCHITECTURE: "amd64", CORES: CpuCores.DUAL, UNITS: 1024 },
  MEMORY: { DEDICATED: MemorySize.GB_4, SWAP: MemorySize.GB_2 },
  DISK: { DATASTORE_ID: "fast", SIZE: DiskSize.GB_8 },
  NETWORK_INTERFACE: {
    NAME: "eth0",
    BRIDGE: "vmbr0",
    ENABLED: true,
    FIREWALL: true,
  },
  FEATURES: { FUSE: false, KEYCTL: true, NESTING: true },
  CONSOLE: { ENABLED: true, TTY_COUNT: 2, TYPE: "tty" as ConsoleTypeValue },
  FIREWALL: {
    ENABLED: true,
    DHCP: true,
    NDP: true,
    RADV: false,
    MACFILTER: true,
    IPFILTER: false,
  },
  FIREWALL_RULE: { ENABLED: true },
  PROVISIONER: {
    TIMEOUT_SECONDS: 600,
    WORKING_DIRECTORY: "/tmp",
    RUN_ON: ["create"] as typeof SCRIPT_RUN_ON_VALUES,
    ANSIBLE_REPLAYABLE: true,
  },
};

/////////////////////////////////////////
//////// Library-defined schemas ////////
/////////////////////////////////////////

/**
 * @see {@link types.input.CT.ContainerStartup}
 */
const StartupConfigSchema = z.object({
  down_delay: z.number().optional(),
  order: z.number().optional(),
  up_delay: z.number().optional(),
});

/**
 * @see {@link types.input.CT.ContainerClone}
 */
const CloneConfigSchema = z
  .object({
    datastore_id: z.string().optional(),
    node_name: z.string().optional(),
    vm_id: z.number(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerOperatingSystem}
 */
const OsConfigSchema = z
  .object({ template_file_id: z.string(), type: z.string().optional() })
  .strict();

/**
 * @see {@link types.input.CT.ContainerCpu}
 */
const CpuConfigSchema = z
  .object({
    architecture: z.string().optional(),
    cores: z.number().positive().optional(),
    units: z.number().positive().optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerMemory}
 */
const MemoryConfigSchema = z
  .object({
    dedicated: z.number().positive().optional(),
    swap: z.number().positive().optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerDisk}
 */
const DiskConfigSchema = z
  .object({
    datastore_id: z.string().default(LXC_DEFAULTS.DATASTORE_ID),
    size: z.number().positive().optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerNetworkInterface}
 */
const NetworkInterfacesSchema = z
  .object({
    name: z.string().min(1),
    bridge: z.string().default(LXC_DEFAULTS.NETWORK_BRIDGE),
    enabled: z.boolean().default(LXC_DEFAULTS.NETWORK_INTERFACE.ENABLED),
    firewall: z.boolean().default(LXC_DEFAULTS.NETWORK_INTERFACE.FIREWALL),
    mac_address: z.string().optional(),
    mtu: z.number().min(1).optional(),
    rate_limit: z.number().optional(),
    vlan_id: z.number().optional(),
  })
  .strict();

type FeaturesMountsValues = "cifs" | "nfs";
const FEATURES_MOUNTS_VALUES: FeaturesMountsValues[] = ["cifs", "nfs"];

/**
 * @see {@link types.input.CT.ContainerFeatures}
 */
const FeaturesSchema = z
  .object({
    fuse: z.boolean().default(LXC_DEFAULTS.FEATURES.FUSE),
    keyctl: z.boolean().default(LXC_DEFAULTS.FEATURES.KEYCTL),
    nesting: z.boolean().default(LXC_DEFAULTS.FEATURES.NESTING),
    mounts: z.array(z.enum(FEATURES_MOUNTS_VALUES)).optional(),
  })
  .strict();

type ConsoleTypeValue = "tty" | "console" | "shell";
const CONSOLE_TYPE_VALUES: ConsoleTypeValue[] = ["console", "shell", "tty"];

/**
 * @see {@link types.input.CT.ContainerConsole}
 */
const ConsoleSchema = z
  .object({
    enabled: z.boolean().default(LXC_DEFAULTS.CONSOLE.ENABLED),
    tty_count: z.number().int().default(LXC_DEFAULTS.CONSOLE.TTY_COUNT),
    type: z.enum(CONSOLE_TYPE_VALUES).default(LXC_DEFAULTS.CONSOLE.TYPE),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerMountPoint}
 */
const MountPointSchema = z
  .object({
    volume: z.string().min(1),
    mount_point: z.string().min(1),
    size: z.number().positive().optional(),
    acl: z.boolean().optional(),
    backup: z.boolean().optional(),
    quota: z.boolean().optional(),
    replicate: z.boolean().optional(),
    shared: z.boolean().optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerDevicePassthrough}
 */
const DevicePassthroughSchema = z
  .object({
    path: z.string().min(1),
    deny_write: z.boolean().optional(),
    uid: z.number().optional(),
    gid: z.number().optional(),
    mode: z.string().length(4).optional(),
  })
  .strict();

/**
 * @see {@link remote.ConnectionArgs}
 */
const AnsibleConnectionOverrideSchema = z
  .object({
    host: z.string().optional(),
    user: z.string().optional(),
    port: z.number().positive().optional(),
    /**
     * Path to private key file. Required to invoke Ansible
     */
    private_key_path: z.string().optional(),
  })
  .strict();

/**
 * @see {@link remote.ConnectionArgs}
 */
const ScriptConnectionOverrideSchema = z
  .object({
    host: z.string().optional(),
    user: z.string().optional(),
    port: z.number().positive().optional(),
    private_key: z.string().optional(),
  })
  .strict();

/**
 * @see {@link network.FirewallOptionsArgs}
 */
const FirewallOptionsSchema = z
  .object({
    container_id: z.number().optional(),
    enabled: z.boolean().default(LXC_DEFAULTS.FIREWALL.ENABLED).optional(),
    dhcp: z.boolean().default(LXC_DEFAULTS.FIREWALL.DHCP).optional(),
    ndp: z.boolean().default(LXC_DEFAULTS.FIREWALL.NDP).optional(),
    radv: z.boolean().default(LXC_DEFAULTS.FIREWALL.RADV).optional(),
    macfilter: z.boolean().default(LXC_DEFAULTS.FIREWALL.MACFILTER).optional(),
    ipfilter: z.boolean().default(LXC_DEFAULTS.FIREWALL.IPFILTER).optional(),
    log_level_in: z
      .enum(PveFirewallLogLevel)
      .default(PveFirewallLogLevel.nolog)
      .optional(),
    log_level_out: z
      .enum(PveFirewallLogLevel)
      .default(PveFirewallLogLevel.nolog)
      .optional(),
    input_policy: z
      .enum(PveFirewallPolicy)
      .default(PveFirewallPolicy.DROP)
      .optional(),
    output_policy: z
      .enum(PveFirewallPolicy)
      .default(PveFirewallPolicy.ACCEPT)
      .optional(),
  })
  .strict();

/**
 * @see {@link types.input.Network.FirewallRulesRule}
 */
const FirewallRuleSchema = z
  .object({
    enabled: z.boolean().default(LXC_DEFAULTS.FIREWALL_RULE.ENABLED).optional(),
    type: z.enum(PveFirewallDirection).optional(),
    action: z.enum(PveFirewallPolicy).optional(),
    comment: z.string().optional(),
    source: z.string().optional(),
    sport: z.string().optional(),
    dest: z.string().optional(),
    dport: z.string().optional(),
    iface: z.string().optional(),
    log: z.enum(PveFirewallLogLevel).optional(),
    macro: z.enum(PveFirewallMacro).optional(),
    pos: z.number().optional(),
    proto: z.string().optional(),
    security_group: z.string().optional(),
  })
  .strict();

const SCRIPT_RUN_ON_VALUES: ("create" | "update" | "delete")[] = [
  "create",
  "update",
  "delete",
];

////////////////////////////////////////
//////////// Custom schemas ////////////
////////////////////////////////////////

const ScriptProvisionerSchema = z
  .object({
    type: z.literal("script"),
    script: z.string().min(1),
    working_directory: z
      .string()
      .default(LXC_DEFAULTS.PROVISIONER.WORKING_DIRECTORY),
    run_as: z.string().default(LXC_DEFAULTS.SSH_USER),
    environment: z.record(z.string(), z.string()).optional(),
    timeout: z
      .number()
      .positive()
      .default(LXC_DEFAULTS.PROVISIONER.TIMEOUT_SECONDS),
    connection: ScriptConnectionOverrideSchema.optional(),
    run_on: z
      .array(z.enum(SCRIPT_RUN_ON_VALUES))
      .optional()
      .default(LXC_DEFAULTS.PROVISIONER.RUN_ON),
  })
  .strict();

/**
 * @see {@link PlaybookArgs}
 */
const AnsibleProvisionerSchema = z
  .object({
    type: z.literal("ansible"),
    playbook: z.string().min(1),
    variables: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
    limit: z.string().optional(),
    timeout: z
      .number()
      .positive()
      .default(LXC_DEFAULTS.PROVISIONER.TIMEOUT_SECONDS),
    replayable: z
      .boolean()
      .default(LXC_DEFAULTS.PROVISIONER.ANSIBLE_REPLAYABLE),
    connection: AnsibleConnectionOverrideSchema.optional(),
  })
  .strict();

const ProvisionerSchema = z.discriminatedUnion("type", [
  ScriptProvisionerSchema,
  AnsibleProvisionerSchema,
]);

const StackSchema = z
  .object({ subdomain_prefixes: z.record(z.string(), z.string()).optional() })
  .strict();

const StackSchemaMap = z.record(z.string(), StackSchema);

/**
 * @see {@link ct.ContainerArgs}
 */
export const LxcHostConfigSchema = z
  .object({
    id: z.number().int().min(1).max(255),
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
      input_policy: PveFirewallPolicy.DROP,
      output_policy: PveFirewallPolicy.ACCEPT,
      log_level_in: PveFirewallLogLevel.nolog,
      log_level_out: PveFirewallLogLevel.nolog,
    }),
    firewall_rules: z.array(FirewallRuleSchema).optional(),

    // HaC custom fields
    stacks: StackSchemaMap.optional(),
    provisioners: z.array(ProvisionerSchema).optional(),
  })
  .strict();

export type LxcHostConfigToml = z.infer<typeof LxcHostConfigSchema>;

export type LxcHostConfig = CamelCasedPropertiesDeep<LxcHostConfigToml>;
export type Provisioner = CamelCasedPropertiesDeep<
  z.infer<typeof ProvisionerSchema>
>;
export type ScriptProvisioner = CamelCasedPropertiesDeep<
  z.infer<typeof ScriptProvisionerSchema>
>;
export type AnsibleProvisioner = CamelCasedPropertiesDeep<
  z.infer<typeof AnsibleProvisionerSchema>
>;
export type ConnectionOverride = CamelCasedPropertiesDeep<
  z.infer<typeof AnsibleConnectionOverrideSchema>
>;
export type FirewallOptions = CamelCasedPropertiesDeep<
  z.infer<typeof FirewallOptionsSchema>
>;
