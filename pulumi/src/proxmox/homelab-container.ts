import * as pulumi from '@pulumi/pulumi';
import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import {
  CpuCores,
  DiskSize,
  MemorySize,
  ProxmoxFirewallLogLevel,
  ProxmoxFirewallPolicy,
} from '../constants';
import { homelabConfig, homelabProvider } from './homelab';
import { debian12 } from './templates';

const pveNodeName = homelabConfig.require('pveNodeName');
const localIpPrefix = homelabConfig.require('localIpPrefix');
const gatewayIp = homelabConfig.require('gatewayIp');

const defaultRootPassword = homelabConfig.requireSecret('lxcRootPassword');
const lxcPublicSshKey = homelabConfig.requireSecret('lxcPublicSshKey');

export type HomelabContainerArgs = {
  id: number;
  hostname: string;
  description?: string;
  tags?: string[];
  os?: proxmox.types.input.CT.ContainerOperatingSystem;
  cpu?: proxmox.types.input.CT.ContainerCpu;
  memory?: proxmox.types.input.CT.ContainerMemory;
  disk?: proxmox.types.input.CT.ContainerDisk;
};

export class HomelabContainer extends pulumi.ComponentResource {
  container: proxmox.ct.Container;

  firewallOptions: proxmox.network.FirewallOptions;

  firewallAlias: proxmox.network.FirewallAlias;

  constructor(
    name: string,
    args: HomelabContainerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('pkg:proxmox:HomelabContainer', name, {}, opts);

    const ctName = `${args.hostname}-lxc`;
    const ctCidr = `${localIpPrefix}.${args.id}/24`;

    this.container = new proxmox.ct.Container(
      ctName,
      {
        nodeName: pveNodeName,
        vmId: args.id,
        description: args.description ?? 'managed by pulumi',
        tags: ['pulumi', ...(args.tags ?? [])],
        unprivileged: true,
        startOnBoot: true,
        protection: false,
        operatingSystem: args.os ?? debian12,
        initialization: {
          hostname: args.hostname,
          ipConfigs: [
            {
              ipv4: {
                address: ctCidr,
                gateway: gatewayIp,
              },
            },
          ],
          userAccount: {
            keys: [lxcPublicSshKey],
            password: defaultRootPassword,
          },
        },
        networkInterfaces: [
          {
            name: 'eth0',
            bridge: 'vmbr0',
            firewall: true,
          },
        ],
        cpu: args.cpu ?? {
          architecture: 'amd64',
          cores: CpuCores.DUAL,
          units: 1024,
        },
        memory: args.memory ?? {
          dedicated: MemorySize.GB_4,
          swap: MemorySize.GB_2,
        },
        disk: args.disk ?? {
          datastoreId: 'local-lvm',
          size: DiskSize.GB_8,
        },
        features: {
          nesting: true,
          keyctl: true,
          fuse: false,
          mounts: [],
        },
        console: {
          enabled: true,
          type: 'tty',
          ttyCount: 2,
        },
      },
      { provider: homelabProvider, parent: this },
    );

    this.firewallOptions = new proxmox.network.FirewallOptions(
      `${ctName}-fw-options`,
      {
        nodeName: pveNodeName,
        containerId: args.id,
        enabled: true,
        // copied values from the default firewall config for a new ct
        dhcp: true,
        ndp: true,
        radv: false,
        macfilter: true,
        ipfilter: false,
        logLevelIn: ProxmoxFirewallLogLevel.nolog,
        logLevelOut: ProxmoxFirewallLogLevel.nolog,
        inputPolicy: ProxmoxFirewallPolicy.DROP,
        outputPolicy: ProxmoxFirewallPolicy.ACCEPT,
      },
      {
        provider: homelabProvider,
        parent: this,
        dependsOn: [this.container],
      },
    );

    const fwAliasName = `${ctName}-fw-alias`;
    this.firewallAlias = new proxmox.network.FirewallAlias(
      fwAliasName,
      {
        nodeName: pveNodeName,
        containerId: args.id,
        name: fwAliasName,
        cidr: ctCidr,
        comment: 'created by pulumi',
      },
      {
        provider: homelabProvider,
        parent: this,
        dependsOn: [this.container],
      },
    );

    this.registerOutputs();
  }
}

const containers: HomelabContainerArgs[] = [
  {
    id: 206,
    hostname: 'dashboard',
    tags: ['monitoring'],
  },
  {
    id: 207,
    hostname: 'foobar',
    tags: ['baz'],
  },
];

export function deployContainers() {
  for (const ct of containers) {
    new HomelabContainer(`${ct.hostname}-homelab-container`, ct);
  }
}
