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
} from "../constants";

export const LXC_DEFAULTS = {
  DATASTORE_ID: "fast",
  NETWORK_BRIDGE: "vmbr0",
  SSH_USER: "root",
  SSH_PORT: CommonPorts.SSH,
  SSH_PRIVATE_KEY_FILE: "~/.ssh/lxc_ed25519",
  DESCRIPTION: "managed by pulumi",
  UNPRIVILEGED: true,
  START_ON_BOOT: true,
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

const CpuConfigSchema = z
  .object({
    architecture: z.string().optional(),
    cores: z.number().positive().optional(),
    units: z.number().positive().optional(),
  })
  .strict();

const MemoryConfigSchema = z
  .object({
    dedicated: z.number().positive().optional(),
    swap: z.number().positive().optional(),
  })
  .strict();

const DiskConfigSchema = z
  .object({
    datastoreId: z.string().default(LXC_DEFAULTS.DATASTORE_ID),
    size: z.number().positive().optional(),
  })
  .strict();

const OsConfigSchema = z
  .object({ templateFileId: z.string(), type: z.string().optional() })
  .strict();

const NetworkInterfacesSchema = z
  .object({
    /**
     * The network interface name.
     */
    name: z.string().min(1),
    /**
     * The name of the network bridge (defaults
     * to `vmbr0`).
     */
    bridge: z.string().default(LXC_DEFAULTS.NETWORK_BRIDGE),
    /**
     * Whether to enable the network device (defaults
     * to `true`).
     */
    enabled: z.boolean().default(LXC_DEFAULTS.NETWORK_INTERFACE.ENABLED),
    /**
     * Whether this interface's firewall rules should be
     * used (defaults to `true`).
     */
    firewall: z.boolean().default(LXC_DEFAULTS.NETWORK_INTERFACE.FIREWALL),
    /**
     * The MAC address.
     */
    macAddress: z.string().optional(),
    /**
     * Maximum transfer unit of the interface. Cannot be
     * larger than the bridge's MTU.
     */
    mtu: z.number().min(1).optional(),
    /**
     * The rate limit in megabytes per second.
     */
    rateLimit: z.number().optional(),
    /**
     * The VLAN identifier.
     */
    vlanId: z.number().optional(),
  })
  .strict();

type FeaturesMountsValues = "cifs" | "nfs";
const FEATURES_MOUNTS_VALUES: FeaturesMountsValues[] = ["cifs", "nfs"];

const FeaturesSchema = z
  .object({
    /**
     * Whether the container supports FUSE mounts (defaults to `false`)
     */
    fuse: z.boolean().default(LXC_DEFAULTS.FEATURES.FUSE),
    /**
     * Whether the container supports `keyctl()` system call (defaults to `true`)
     */
    keyctl: z.boolean().default(LXC_DEFAULTS.FEATURES.KEYCTL),
    /**
     * List of allowed mount types (`cifs` or `nfs`)
     */
    mounts: z.array(z.enum(FEATURES_MOUNTS_VALUES)).optional(),
    /**
     * Whether the container is nested (defaults to `true`)
     */
    nesting: z.boolean().default(LXC_DEFAULTS.FEATURES.NESTING),
  })
  .strict();

type ConsoleTypeValue = "tty" | "console" | "shell";
const CONSOLE_TYPE_VALUES: ConsoleTypeValue[] = ["console", "shell", "tty"];

const ConsoleSchema = z
  .object({
    /**
     * Whether to enable the console device (defaults
     * to `true`).
     */
    enabled: z.boolean().default(LXC_DEFAULTS.CONSOLE.ENABLED),
    /**
     * The number of available TTY (defaults to `2`).
     */
    ttyCount: z.number().int().default(LXC_DEFAULTS.CONSOLE.TTY_COUNT),
    /**
     * The console mode (defaults to `tty`).
     */
    type: z.enum(CONSOLE_TYPE_VALUES).default(LXC_DEFAULTS.CONSOLE.TYPE),
  })
  .strict();

const MountPointSchema = z
  .object({
    volume: z.string().min(1),
    mountPoint: z.string().min(1),
    size: z.number().positive().optional(),
    acl: z.boolean().optional(),
    backup: z.boolean().optional(),
    quota: z.boolean().optional(),
    replicate: z.boolean().optional(),
    shared: z.boolean().optional(),
  })
  .strict();

const DevicePassthroughSchema = z
  .object({
    path: z.string().min(1),
    denyWrite: z.boolean().optional(),
    uid: z.number().optional(),
    gid: z.number().optional(),
    mode: z.string().length(4).optional(),
  })
  .strict();

const AnsibleConnectionOverrideSchema = z
  .object({
    host: z.string().optional(),
    user: z.string().optional().default(LXC_DEFAULTS.SSH_USER),
    port: z.number().positive().optional().default(LXC_DEFAULTS.SSH_PORT),
    privateKeyFile: z
      .string()
      .optional()
      .default(LXC_DEFAULTS.SSH_PRIVATE_KEY_FILE),
  })
  .strict();

const ScriptConnectionOverrideSchema = z
  .object({
    host: z.string().optional(),
    user: z.string().optional().default(LXC_DEFAULTS.SSH_USER),
    port: z.number().positive().optional().default(LXC_DEFAULTS.SSH_PORT),
    privateKey: z.string().optional(),
  })
  .strict();

const FirewallOptionsSchema = z
  .object({
    containerId: z.number().optional(),
    enabled: z.boolean().default(LXC_DEFAULTS.FIREWALL.ENABLED).optional(),

    dhcp: z.boolean().default(LXC_DEFAULTS.FIREWALL.DHCP).optional(),
    /**
     * Enable NDP (Neighbor Discovery Protocol).
     */
    ndp: z.boolean().default(LXC_DEFAULTS.FIREWALL.NDP).optional(),
    /**
     * Enable Router Advertisement.
     */
    radv: z.boolean().default(LXC_DEFAULTS.FIREWALL.RADV).optional(),
    /**
     * Enable/disable MAC address filter.
     */
    macfilter: z.boolean().default(LXC_DEFAULTS.FIREWALL.MACFILTER).optional(),
    /**
     * Enable default IP filters. This is equivalent to
     * adding an empty `ipfilter-net<id>` ipset for every interface. Such ipsets
     * implicitly contain sane default restrictions such as restricting IPv6 link
     * local addresses to the one derived from the interface's MAC address. For
     * containers the configured IP addresses will be implicitly added.
     */
    ipfilter: z.boolean().default(LXC_DEFAULTS.FIREWALL.IPFILTER).optional(),
    logLevelIn: z
      .enum(PveFirewallLogLevel)
      .default(PveFirewallLogLevel.nolog)
      .optional(),
    logLevelOut: z
      .enum(PveFirewallLogLevel)
      .default(PveFirewallLogLevel.nolog)
      .optional(),
    inputPolicy: z
      .enum(PveFirewallPolicy)
      .default(PveFirewallPolicy.DROP)
      .optional(),
    outputPolicy: z
      .enum(PveFirewallPolicy)
      .default(PveFirewallPolicy.ACCEPT)
      .optional(),
  })
  .strict();

const FirewallRuleSchema = z
  .object({
    enabled: z.boolean().default(LXC_DEFAULTS.FIREWALL_RULE.ENABLED).optional(),
    type: z.enum(PveFirewallDirection).optional(),
    action: z.enum(PveFirewallPolicy).optional(),
    comment: z.string().optional(),
    /**
     * Restrict packet source address. This can refer
     * to a single IP address, an IP set ('+ipsetname') or an IP alias
     * definition. You can also specify an address range
     * like `20.34.101.207-201.3.9.99`, or a list of IP addresses and
     * networks (entries are separated by comma). Please do not mix IPv4
     * and IPv6 addresses inside such lists.
     */
    source: z.string().optional(),
    /**
     * Restrict TCP/UDP source port. You can use
     * service names or simple numbers (0-65535), as defined
     * in `/etc/services`. Port ranges can be specified with '\d+:\d+', for
     * example `80:85`, and you can use comma separated list to match
     * several ports or ranges.
     */
    sport: z.string().optional(),
    /**
     * Restrict packet destination address. This can
     * refer to a single IP address, an IP set ('+ipsetname') or an IP
     * alias definition. You can also specify an address range
     * like `20.34.101.207-201.3.9.99`, or a list of IP addresses and
     * networks (entries are separated by comma). Please do not mix IPv4
     * and IPv6 addresses inside such lists.
     */
    dest: z.string().optional(),
    /**
     * Restrict TCP/UDP destination port. You can use
     * service names or simple numbers (0-65535), as defined
     * in `/etc/services`. Port ranges can be specified with '\d+:\d+', for
     * example `80:85`, and you can use comma separated list to match
     * several ports or ranges.
     */
    dport: z.string().optional(),
    /**
     * Network interface name. You have to use network
     * configuration key names for VMs and containers ('net\d+'). Host
     * related rules can use arbitrary strings.
     */
    iface: z.string().optional(),
    log: z.enum(PveFirewallLogLevel).optional(),
    macro: z.enum(PveFirewallMacro).optional(),
    /**
     * Position of the rule in the list.
     */
    pos: z.number().optional(),
    /**
     * Restrict packet protocol. You can use protocol
     * names as defined in '/etc/protocols'.
     */
    proto: z.string().optional(),
    securityGroup: z.string().optional(),
  })
  .strict();

const SCRIPT_RUN_ON_VALUES: ("create" | "update" | "delete")[] = [
  "create",
  "update",
  "delete",
];

const ScriptProvisionerSchema = z
  .object({
    type: z.literal("script"),
    script: z.string().min(1),
    workingDirectory: z
      .string()
      .default(LXC_DEFAULTS.PROVISIONER.WORKING_DIRECTORY),
    runAs: z.string().default(LXC_DEFAULTS.SSH_USER),
    environment: z.record(z.string(), z.string()).optional(),
    timeout: z
      .number()
      .positive()
      .default(LXC_DEFAULTS.PROVISIONER.TIMEOUT_SECONDS),
    connection: ScriptConnectionOverrideSchema.optional(),
    runOn: z
      .array(z.enum(SCRIPT_RUN_ON_VALUES))
      .optional()
      .default(LXC_DEFAULTS.PROVISIONER.RUN_ON),
  })
  .strict();

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
  .object({ domainPrefixes: z.record(z.string(), z.string()).optional() })
  .strict();

const StackSchemaMap = z.record(z.string(), StackSchema);

export const LxcHostConfigSchema = z
  .object({
    id: z.number().int().min(1).max(255),
    hostname: z.string().min(1),
    description: z.string().default(LXC_DEFAULTS.DESCRIPTION),
    unprivileged: z.boolean().default(LXC_DEFAULTS.UNPRIVILEGED),
    startOnBoot: z.boolean().default(LXC_DEFAULTS.START_ON_BOOT),
    protection: z.boolean().default(LXC_DEFAULTS.PROTECTION),
    tags: z.array(z.string()).optional(),
    os: OsConfigSchema.default({
      type: LXC_DEFAULTS.OS.TYPE,
      templateFileId: LXC_DEFAULTS.OS.TEMPLATE_FILE_ID,
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
      datastoreId: LXC_DEFAULTS.DISK.DATASTORE_ID,
      size: LXC_DEFAULTS.DISK.SIZE,
    }),
    networkInterfaces: z
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
      ttyCount: LXC_DEFAULTS.CONSOLE.TTY_COUNT,
    }),
    features: FeaturesSchema.default({
      fuse: LXC_DEFAULTS.FEATURES.FUSE,
      keyctl: LXC_DEFAULTS.FEATURES.KEYCTL,
      nesting: LXC_DEFAULTS.FEATURES.NESTING,
    }),
    stacks: StackSchemaMap.optional(),
    mountPoints: z.array(MountPointSchema).optional(),
    devicePassthroughs: z.array(DevicePassthroughSchema).optional(),
    firewallOptions: FirewallOptionsSchema.default({
      enabled: LXC_DEFAULTS.FIREWALL.ENABLED,
      dhcp: LXC_DEFAULTS.FIREWALL.DHCP,
      ndp: LXC_DEFAULTS.FIREWALL.NDP,
      radv: LXC_DEFAULTS.FIREWALL.RADV,
      macfilter: LXC_DEFAULTS.FIREWALL.MACFILTER,
      ipfilter: LXC_DEFAULTS.FIREWALL.IPFILTER,
      inputPolicy: PveFirewallPolicy.DROP,
      outputPolicy: PveFirewallPolicy.ACCEPT,
      logLevelIn: PveFirewallLogLevel.nolog,
      logLevelOut: PveFirewallLogLevel.nolog,
    }),
    firewallRules: z.array(FirewallRuleSchema).optional(),
    provisioners: z.array(ProvisionerSchema).optional(),
  })
  .strict();

export type LxcHostConfigToml = z.infer<typeof LxcHostConfigSchema>;
export type Provisioner = z.infer<typeof ProvisionerSchema>;
export type ScriptProvisioner = z.infer<typeof ScriptProvisionerSchema>;
export type AnsibleProvisioner = z.infer<typeof AnsibleProvisionerSchema>;
export type ConnectionOverride = z.infer<
  typeof AnsibleConnectionOverrideSchema
>;
export type FirewallOptions = z.infer<typeof FirewallOptionsSchema>;

export const LxcHostnameSchema = z.object({ hostname: z.string().min(1) });

export type LxcHostnameToml = z.infer<typeof LxcHostnameSchema>;
