import { z } from 'zod';
import {
  PveFirewallDirection,
  PveFirewallLogLevel,
  PveFirewallMacro,
  PveFirewallPolicy,
} from '../constants';

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
    datastoreId: z.string().default('fast'),
    size: z.number().positive().optional(),
  })
  .strict();

const OsConfigSchema = z
  .object({
    templateFileId: z.string(),
    type: z.string().optional(),
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
    user: z.string().optional().default('root'),
    port: z.number().positive().optional().default(22),
    privateKeyFile: z.string().optional().default('~/.ssh/lxc_ed25519'),
  })
  .strict();

const ScriptConnectionOverrideSchema = z
  .object({
    host: z.string().optional(),
    user: z.string().optional().default('root'),
    port: z.number().positive().optional().default(22),
    privateKey: z.string().optional(),
  })
  .strict();

const FirewallOptionsSchema = z
  .object({
    containerId: z.number().optional(),
    enabled: z.boolean().default(true).optional(),

    dhcp: z.boolean().default(true).optional(),
    /**
     * Enable NDP (Neighbor Discovery Protocol).
     */
    ndp: z.boolean().default(true).optional(),
    /**
     * Enable Router Advertisement.
     */
    radv: z.boolean().default(false).optional(),
    /**
     * Enable/disable MAC address filter.
     */
    macfilter: z.boolean().default(true).optional(),
    /**
     * Enable default IP filters. This is equivalent to
     * adding an empty `ipfilter-net<id>` ipset for every interface. Such ipsets
     * implicitly contain sane default restrictions such as restricting IPv6 link
     * local addresses to the one derived from the interface's MAC address. For
     * containers the configured IP addresses will be implicitly added.
     */
    ipfilter: z.boolean().default(false).optional(),
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

const DEFAULT_FIREWALL_OPTIONS: FirewallOptions = {
  enabled: true,
  dhcp: true,
  ndp: true,
  radv: false,
  macfilter: true,
  ipfilter: false,
  inputPolicy: PveFirewallPolicy.DROP,
  outputPolicy: PveFirewallPolicy.ACCEPT,
  logLevelIn: PveFirewallLogLevel.nolog,
  logLevelOut: PveFirewallLogLevel.nolog,
};

const FirewallRuleSchema = z
  .object({
    enabled: z.boolean().default(true).optional(),
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

const ScriptProvisionerSchema = z
  .object({
    type: z.literal('script'),
    script: z.string().min(1),
    workingDirectory: z.string().default('/tmp'),
    runAs: z.string().default('root'),
    environment: z.record(z.string(), z.string()).optional(),
    timeout: z.number().positive().default(600),
    connection: ScriptConnectionOverrideSchema.optional(),
    runOn: z
      .array(z.enum(['create', 'update', 'delete']))
      .optional()
      .default(['create']),
  })
  .strict();

const AnsibleProvisionerSchema = z
  .object({
    type: z.literal('ansible'),
    playbook: z.string().min(1),
    variables: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
    limit: z.string().optional(),
    timeout: z.number().positive().default(600),
    replayable: z.boolean().default(true),
    connection: AnsibleConnectionOverrideSchema.optional(),
  })
  .strict();

const ProvisionerSchema = z.discriminatedUnion('type', [
  ScriptProvisionerSchema,
  AnsibleProvisionerSchema,
]);

const StackSchema = z
  .object({
    domainPrefixes: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const StackSchemaMap = z.record(z.string(), StackSchema);

export const LxcHostConfigSchema = z
  .object({
    id: z.number().positive().int(),
    hostname: z.string().min(1),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    os: OsConfigSchema.optional(),
    cpu: CpuConfigSchema.optional(),
    memory: MemoryConfigSchema.optional(),
    disk: DiskConfigSchema.optional(),
    stacks: StackSchemaMap.optional(),
    mountPoints: z.array(MountPointSchema).optional(),
    devicePassthroughs: z.array(DevicePassthroughSchema).optional(),
    firewallOptions: FirewallOptionsSchema.default(DEFAULT_FIREWALL_OPTIONS),
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

export const LxcHostnameSchema = z.object({
  hostname: z.string().min(1),
});

export type LxcHostnameToml = z.infer<typeof LxcHostnameSchema>;