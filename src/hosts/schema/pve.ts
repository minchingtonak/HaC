import { z } from "zod";
import type {
  // :/
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ProviderArgs,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  DNSArgs,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  network,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  download,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  types,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  metrics,
} from "@muhlba91/pulumi-proxmoxve";
import {
  CommonPorts,
  CpuCores,
  MemorySize,
  DiskSize,
  ScriptProvisionerRunOn,
  FeaturesMounts,
  ConsoleType,
  FirewallForwardPolicy,
  FirewallInputOutputPolicy,
  DownloadFileChecksumAlgorithm,
  DownloadFileContentType,
  DownloadFileDecompressionAlgorithm,
  MetricsServerGraphiteProto,
  MetricsServerInfluxDbProto,
  MetricsServerType,
  FirewallLogLevel,
  FirewallPolicy,
  FirewallMacro,
  FirewallDirection,
} from "../../constants";
import type {
  FeaturesMountsValue,
  ConsoleTypeValue,
  FirewallForwardPolicyValue,
  FirewallInputOutputPolicyValue,
  DownloadFileChecksumAlgorithmValue,
  DownloadFileContentTypeValue,
  DownloadFileDecompressionAlgorithmValue,
  MetricsServerGraphiteProtoValue,
  MetricsServerInfluxDbProtoValue,
  MetricsServerTypeValue,
} from "../../constants";

export const PVE_DEFAULTS = {
  AUTH: { USERNAME: "root", INSECURE: false },
  DNS: { SERVERS: ["8.8.8.8", "1.1.1.1", "8.8.4.4"] },
  FIREWALL: { RATE_LIMIT: { BURST: 5, RATE: "1/second" } },
  DOWNLOAD_FILE: {
    OVERWRITE: true,
    UPLOAD_TIMEOUT: 600,
    VERIFY: true,
    RETAIN_ON_DELETE: false,
  },
  METRICS_SERVER: {
    GRAPHITE_PROTO: "udp",
    INFLUX_DB_PROTO: "udp",
    INFLUX_MAX_BODY_SIZE: 25000000,
    MTU: 1500,
    TIMEOUT: 1,
  },
  LXC_HOST: { ENABLED: true },
  HOST: { ENABLED: true },
} as const;

export const LXC_DEFAULTS = {
  DATASTORE_ID: "fast",
  NETWORK_BRIDGE: "vmbr0",
  USER: "root",
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
  CONSOLE: { ENABLED: true, TTY_COUNT: 2, TYPE: ConsoleType.TTY },
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
    RUN_ON: [ScriptProvisionerRunOn.CREATE],
    ANSIBLE_REPLAYABLE: true,
  },
} as const;

/**
 * @see {@link types.input.CT.ContainerStartup}
 */
export const StartupConfigSchema = z.object({
  down_delay: z.number().optional(),
  order: z.number().optional(),
  up_delay: z.number().optional(),
});

/**
 * @see {@link types.input.CT.ContainerClone}
 */
export const CloneConfigSchema = z
  .object({
    datastore_id: z.string().optional(),
    node_name: z.string().optional(),
    vm_id: z.number(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerOperatingSystem}
 */
export const OsConfigSchema = z
  .object({ template_file_id: z.string(), type: z.string().optional() })
  .strict();

/**
 * @see {@link types.input.CT.ContainerCpu}
 */
export const CpuConfigSchema = z
  .object({
    architecture: z.string().optional(),
    cores: z.number().positive().optional(),
    units: z.number().positive().optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerMemory}
 */
export const MemoryConfigSchema = z
  .object({
    dedicated: z.number().positive().optional(),
    swap: z.number().positive().optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerDisk}
 */
export const DiskConfigSchema = z
  .object({
    datastore_id: z.string().default(LXC_DEFAULTS.DATASTORE_ID),
    size: z.number().positive().optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerNetworkInterface}
 */
export const NetworkInterfacesSchema = z
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

/**
 * @see {@link types.input.CT.ContainerFeatures}
 */
export const FeaturesSchema = z
  .object({
    fuse: z.boolean().default(LXC_DEFAULTS.FEATURES.FUSE),
    keyctl: z.boolean().default(LXC_DEFAULTS.FEATURES.KEYCTL),
    nesting: z.boolean().default(LXC_DEFAULTS.FEATURES.NESTING),
    mounts: z
      .array(z.enum(Object.values(FeaturesMounts) as FeaturesMountsValue[]))
      .optional(),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerConsole}
 */
export const ConsoleSchema = z
  .object({
    enabled: z.boolean().default(LXC_DEFAULTS.CONSOLE.ENABLED),
    tty_count: z.number().int().default(LXC_DEFAULTS.CONSOLE.TTY_COUNT),
    type: z
      .enum(Object.values(ConsoleType) as ConsoleTypeValue[])
      .default(LXC_DEFAULTS.CONSOLE.TYPE),
  })
  .strict();

/**
 * @see {@link types.input.CT.ContainerMountPoint}
 */
export const MountPointSchema = z
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
export const DevicePassthroughSchema = z
  .object({
    path: z.string().min(1),
    deny_write: z.boolean().optional(),
    uid: z.number().optional(),
    gid: z.number().optional(),
    mode: z.string().length(4).optional(),
  })
  .strict();

/**
 * @see {@link network.FirewallOptionsArgs}
 */
export const FirewallOptionsSchema = z
  .object({
    enabled: z.boolean().default(LXC_DEFAULTS.FIREWALL.ENABLED).optional(),
    dhcp: z.boolean().default(LXC_DEFAULTS.FIREWALL.DHCP).optional(),
    ndp: z.boolean().default(LXC_DEFAULTS.FIREWALL.NDP).optional(),
    radv: z.boolean().default(LXC_DEFAULTS.FIREWALL.RADV).optional(),
    macfilter: z.boolean().default(LXC_DEFAULTS.FIREWALL.MACFILTER).optional(),
    ipfilter: z.boolean().default(LXC_DEFAULTS.FIREWALL.IPFILTER).optional(),
    log_level_in: z
      .enum(FirewallLogLevel)
      .default(FirewallLogLevel.nolog)
      .optional(),
    log_level_out: z
      .enum(FirewallLogLevel)
      .default(FirewallLogLevel.nolog)
      .optional(),
    input_policy: z
      .enum(FirewallPolicy)
      .default(FirewallPolicy.DROP)
      .optional(),
    output_policy: z
      .enum(FirewallPolicy)
      .default(FirewallPolicy.ACCEPT)
      .optional(),
  })
  .strict();

/**
 * @see {@link types.input.Network.FirewallRulesRule}
 */
export const FirewallRuleSchema = z
  .object({
    enabled: z.boolean().default(LXC_DEFAULTS.FIREWALL_RULE.ENABLED).optional(),
    type: z.enum(FirewallDirection).optional(),
    action: z.enum(FirewallPolicy).optional(),
    comment: z.string().optional(),
    source: z.string().optional(),
    sport: z.string().optional(),
    dest: z.string().optional(),
    dport: z.string().optional(),
    iface: z.string().optional(),
    log: z.enum(FirewallLogLevel).optional(),
    macro: z.enum(FirewallMacro).optional(),
    pos: z.number().optional(),
    proto: z.string().optional(),
    security_group: z.string().optional(),
  })
  .strict();

/**
 * @see {@link ProviderArgs}
 */
export const PveAuthSchema = z
  .object({
    username: z.string().default(PVE_DEFAULTS.AUTH.USERNAME),
    password: z.string().min(1),
    insecure: z.boolean().default(PVE_DEFAULTS.AUTH.INSECURE),
  })
  .strict();

/**
 * @see {@link DNSArgs}
 */
export const DnsSchema = z
  .object({
    domain: z.string().min(1),
    servers: z
      .array(z.string())
      // @ts-expect-error allowing use of readonly type since LXC_DEFAULTS uses `as const`
      .default(PVE_DEFAULTS.DNS.SERVERS),
  })
  .strict();

/**
 * @see {@link types.input.Network.FirewallLogRatelimit}
 */
export const FirewallLogRatelimitSchema = z
  .object({
    burst: z.number().default(PVE_DEFAULTS.FIREWALL.RATE_LIMIT.BURST),
    enabled: z.boolean().optional(),
    rate: z.string().default(PVE_DEFAULTS.FIREWALL.RATE_LIMIT.RATE),
  })
  .strict();

/**
 * @see {@link network.FirewallArgs}
 */
export const FirewallSchema = z
  .object({
    ebtables: z.boolean().optional(),
    enabled: z.boolean().optional(),
    forward_policy: z
      .enum(
        Object.values(FirewallForwardPolicy) as FirewallForwardPolicyValue[],
      )
      .optional(),
    input_policy: z
      .enum(
        Object.values(
          FirewallInputOutputPolicy,
        ) as FirewallInputOutputPolicyValue[],
      )
      .optional(),
    log_ratelimit: FirewallLogRatelimitSchema.default({
      enabled: false,
      burst: PVE_DEFAULTS.FIREWALL.RATE_LIMIT.BURST,
      rate: PVE_DEFAULTS.FIREWALL.RATE_LIMIT.RATE,
    }),
    output_policy: z
      .enum(
        Object.values(
          FirewallInputOutputPolicy,
        ) as FirewallInputOutputPolicyValue[],
      )
      .optional(),
  })
  .strict();

/**
 * @see {@link download.FileArgs}
 */
export const DownloadFileSchema = z
  .object({
    checksum: z.string().optional(),
    checksum_algorithm: z
      .enum(
        Object.values(
          DownloadFileChecksumAlgorithm,
        ) as DownloadFileChecksumAlgorithmValue[],
      )
      .optional(),
    content_type: z.enum(
      Object.values(DownloadFileContentType) as DownloadFileContentTypeValue[],
    ),
    datastore_id: z.string().min(1),
    decompression_algorithm: z
      .enum(
        Object.values(
          DownloadFileDecompressionAlgorithm,
        ) as DownloadFileDecompressionAlgorithmValue[],
      )
      .optional(),
    file_name: z.string().optional(),
    overwrite: z.boolean().default(PVE_DEFAULTS.DOWNLOAD_FILE.OVERWRITE),
    overwrite_unmanaged: z.boolean().optional(),
    upload_timeout: z
      .number()
      .int()
      .default(PVE_DEFAULTS.DOWNLOAD_FILE.UPLOAD_TIMEOUT),
    url: z.string().regex(/^https?:\/\/.*/),
    verify: z.boolean().default(PVE_DEFAULTS.DOWNLOAD_FILE.VERIFY),

    // pulumi custom fields
    retain_on_delete: z
      .boolean()
      .default(PVE_DEFAULTS.DOWNLOAD_FILE.RETAIN_ON_DELETE),
  })
  .strict();

/**
 * @see {@link metrics.MetricsServerArgs}
 */
export const MetricsServerSchema = z
  .object({
    disable: z.boolean().optional(),
    graphite_path: z.string().optional(),
    graphite_proto: z
      .enum(
        Object.values(
          MetricsServerGraphiteProto,
        ) as MetricsServerGraphiteProtoValue[],
      )
      .default(MetricsServerGraphiteProto.UDP),
    influx_api_path_prefix: z.string().optional(),
    influx_bucket: z.string().optional(),
    influx_db_proto: z
      .enum(
        Object.values(
          MetricsServerInfluxDbProto,
        ) as MetricsServerInfluxDbProtoValue[],
      )
      .default(MetricsServerInfluxDbProto.UDP),
    influx_max_body_size: z
      .number()
      .int()
      .default(PVE_DEFAULTS.METRICS_SERVER.INFLUX_MAX_BODY_SIZE),
    influx_organization: z.string().optional(),
    influx_token: z.string().optional(),
    influx_verify: z.boolean().optional(),
    mtu: z
      .number()
      .int()
      .min(512)
      .max(65536)
      .default(PVE_DEFAULTS.METRICS_SERVER.MTU),
    name: z.string().optional(),
    port: z.number().int().min(1).max(65536),
    server: z.string(),
    timeout: z.number().int().default(PVE_DEFAULTS.METRICS_SERVER.TIMEOUT),
    type: z.enum(Object.values(MetricsServerType) as MetricsServerTypeValue[]),
  })
  .strict();
