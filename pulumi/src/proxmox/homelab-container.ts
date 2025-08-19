import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
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
import { ComposeStack } from '../docker/compose-stack';
import { HostConfigToml } from './host-config-parser';

// FIXME static variables of HomelabContainer? separate module for homelab config?
const pveNodeName = homelabConfig.require('pveNodeName');
const localIpPrefix = homelabConfig.require('localIpPrefix');
const gatewayIp = homelabConfig.require('gatewayIp');

const defaultRootPassword = homelabConfig.requireSecret('lxcRootPassword');
const lxcPublicSshKey = homelabConfig.requireSecret('lxcPublicSshKey');
const lxcPrivateSshKey = homelabConfig.requireSecret('lxcPrivateSshKey');

export type HomelabContainerArgs = HostConfigToml;

export class HomelabContainer extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = 'HaC:proxmoxve:HomelabContainer';

  container: proxmox.ct.Container;

  firewallOptions: proxmox.network.FirewallOptions;

  firewallAlias: proxmox.network.FirewallAlias;

  services: ComposeStack[] = [];

  constructor(
    name: string,
    args: HomelabContainerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HomelabContainer.RESOURCE_TYPE, name, {}, opts);

    const ctName = `${args.hostname}-lxc`;
    const ctAddress = `${localIpPrefix}.${args.id}`;
    const ctCidr = `${ctAddress}/24`;

    const mountPoints = args.mountPoints?.map((mp) => ({
      volume: mp.volume,
      path: mp.mountPoint,
      size: mp.size ? `${mp.size}G` : undefined,
      acl: mp.acl,
      backup: mp.backup,
      quota: mp.quota,
      replicate: mp.replicate,
      shared: mp.shared,
    })) ?? [];

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
        mountPoints: mountPoints,
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
          datastoreId: 'fast',
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
        enabled: false, // TODO configurable firewall rules
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
        dependsOn: this.container,
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
        dependsOn: this.container,
      },
    );

    if (args.services) {
      const connection: command.types.input.remote.ConnectionArgs = {
        host: ctAddress,
        user: 'root',
        privateKey: lxcPrivateSshKey,
      };

      const installDocker = new command.remote.Command(
        `${ctName}-install-docker`,
        {
          create: 'wget -qO- https://get.docker.com | sh',
          connection,
        },
        {
          parent: this,
          dependsOn: this.container,
        },
      );

      for (const name of args.services) {
        this.services.push(
          new ComposeStack(
            `${name}-compose-service`,
            {
              serviceName: name,
              connection,
            },
            {
              parent: this.container,
              dependsOn: installDocker,
            },
          ),
        );
      }
    }

    this.registerOutputs();
  }
}
