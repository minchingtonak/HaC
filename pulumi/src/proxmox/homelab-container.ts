import * as pulumi from '@pulumi/pulumi';
import * as command from '@pulumi/command';
import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import * as porkbun from '@pulumi/porkbun';
import * as path from 'path';
import {
  CpuCores,
  DiskSize,
  MemorySize,
  PveFirewallDirection,
  PveFirewallMacro,
  PveFirewallPolicy,
} from '../constants';
import { HomelabProvider } from './homelab-provider';
import { ComposeStack } from '../docker/compose-stack';
import {
  ProvisionerEngine,
  ProvisionerResource,
} from '../hosts/provisioner-engine';
import { LxcHostConfigToml } from '../hosts/lxc-host-config-schema';
import { TemplateProcessor } from '../templates/template-processor';

export type HomelabContainerArgs = LxcHostConfigToml & {
  provider: HomelabProvider;
};

export class HomelabContainer extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = 'HaC:proxmoxve:HomelabContainer';

  private static CONTAINER_SUBDOMAIN = (hostname: string, nodeName: string) =>
    `${hostname}.pulumi.${nodeName}`;

  private static PROXY_STACK_NAME = 'traefik';

  container: proxmox.ct.Container;

  firewallOptions: proxmox.network.FirewallOptions;

  firewallAlias: proxmox.network.FirewallAlias;

  firewallRules: proxmox.network.FirewallRules;

  provisionerResources: ProvisionerResource[] = [];

  proxyNetwork?: command.remote.Command;

  createRemoteOutputRootDir?: command.remote.Command;

  stacks: ComposeStack[] = [];

  baseDnsRecord: porkbun.DnsRecord;

  wildcardDnsRecord: porkbun.DnsRecord;

  constructor(
    name: string,
    args: HomelabContainerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HomelabContainer.RESOURCE_TYPE, name, {}, opts);

    const ctAddress = pulumi.interpolate`${args.provider.localIpPrefix}.${args.id}`;
    const ctCidr = pulumi.interpolate`${ctAddress}/24`;

    const mountPoints =
      args.mountPoints?.map((mp) => ({
        volume: mp.volume,
        path: mp.mountPoint,
        size: mp.size ? `${mp.size}G` : undefined,
        acl: mp.acl,
        backup: mp.backup,
        quota: mp.quota,
        replicate: mp.replicate,
        shared: mp.shared,
      })) ?? [];

    const stackNames = Object.keys(args.stacks ?? {});

    this.container = new proxmox.ct.Container(
      name,
      {
        nodeName: args.provider.pveNodeName,
        vmId: args.id,
        description: args.description ?? 'managed by pulumi',
        tags: [...stackNames, ...(args.tags ?? [])],
        unprivileged: true,
        startOnBoot: true,
        protection: false,
        operatingSystem: args.os ?? {
          type: 'debian',
          templateFileId:
            'local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst',
        },
        mountPoints: mountPoints,
        devicePassthroughs: args.devicePassthroughs,
        initialization: {
          hostname: args.hostname,
          ipConfigs: [
            {
              ipv4: {
                address: ctCidr,
                gateway: args.provider.gatewayIp,
              },
            },
          ],
          userAccount: {
            keys: [args.provider.lxcPublicSshKey],
            password: args.provider.defaultRootPassword,
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
      {
        provider: args.provider,
        parent: this,
        deleteBeforeReplace: true,
      },
    );

    this.firewallOptions = new proxmox.network.FirewallOptions(
      `${name}-fw-options`,
      {
        nodeName: args.provider.pveNodeName,
        containerId: args.id,
        ...args.firewallOptions,
      },
      {
        provider: args.provider,
        parent: this,
        dependsOn: this.container,
        deleteBeforeReplace: true,
      },
    );

    const fwAliasName = `${name}-fw-alias`;
    this.firewallAlias = new proxmox.network.FirewallAlias(
      fwAliasName,
      {
        nodeName: args.provider.pveNodeName,
        containerId: args.id,
        name: fwAliasName,
        cidr: ctCidr,
        comment: 'created by pulumi',
      },
      {
        provider: args.provider,
        parent: this,
        dependsOn: this.container,
        deleteBeforeReplace: true,
      },
    );

    const hasProxy = stackNames.includes(HomelabContainer.PROXY_STACK_NAME);

    if (!hasProxy) {
      throw new Error(
        `Container ${name} must use proxy stack ${HomelabContainer.PROXY_STACK_NAME}`,
      );
    }

    this.firewallRules = new proxmox.network.FirewallRules(
      `${name}-fw-rules`,
      {
        nodeName: args.provider.pveNodeName,
        containerId: args.id,
        rules: [
          {
            enabled: true,
            type: PveFirewallDirection.in,
            action: PveFirewallPolicy.ACCEPT,
            macro: PveFirewallMacro.SSH,
          },
          ...(hasProxy
            ? [
                {
                  enabled: true,
                  type: PveFirewallDirection.in,
                  action: PveFirewallPolicy.ACCEPT,
                  macro: PveFirewallMacro.HTTP,
                },
                {
                  enabled: true,
                  type: PveFirewallDirection.in,
                  action: PveFirewallPolicy.ACCEPT,
                  macro: PveFirewallMacro.HTTPS,
                },
              ]
            : []),
          ...(args.firewallRules ?? []),
        ],
      },
      {
        provider: args.provider,
        parent: this,
        dependsOn: this.container,
        deleteBeforeReplace: true,
      },
    );

    const porkbunProvider = new porkbun.Provider(`${name}-provider`, {
      apiKey: args.provider.porkbunApiKey,
      secretKey: args.provider.porkbunSecretKey,
    });

    this.baseDnsRecord = new porkbun.DnsRecord(
      `${name}-base-dns-record`,
      {
        domain: args.provider.rootContainerDomain,
        subdomain: args.provider.pveNodeName.apply((nodeName: string) =>
          HomelabContainer.CONTAINER_SUBDOMAIN(args.hostname, nodeName),
        ),
        content: ctAddress,
        type: 'A',
      },
      {
        parent: this,
        provider: porkbunProvider,
        deleteBeforeReplace: true,
      },
    );

    this.wildcardDnsRecord = new porkbun.DnsRecord(
      `${name}-wildcard-dns-record`,
      {
        domain: args.provider.rootContainerDomain,
        subdomain: args.provider.pveNodeName.apply(
          (nodeName: string) =>
            '*.' +
            HomelabContainer.CONTAINER_SUBDOMAIN(args.hostname, nodeName),
        ),
        content: ctAddress,
        type: 'A',
      },
      {
        parent: this,
        provider: porkbunProvider,
        deleteBeforeReplace: true,
      },
    );

    const connection: command.types.input.remote.ConnectionArgs = {
      host: ctAddress,
      user: 'root',
      privateKey: args.provider.lxcPrivateSshKey,
    };

    if (args.provisioners && args.provisioners.length > 0) {
      const provisionerEngine = new ProvisionerEngine({
        name,
        connection,
      });

      this.provisionerResources = provisionerEngine.executeProvisioners(
        args.provisioners,
        this.container,
      );
    }

    if (args.stacks) {
      if (hasProxy) {
        this.proxyNetwork = new command.remote.Command(
          `${name}-create-${HomelabContainer.PROXY_STACK_NAME}-network`,
          {
            create: `if ! docker network ls --format "{{.Name}}" | grep -q "^${HomelabContainer.PROXY_STACK_NAME}$"; then docker network create '${HomelabContainer.PROXY_STACK_NAME}'; fi`,
            delete: `if docker network ls --format "{{.Name}}" | grep -q "^${HomelabContainer.PROXY_STACK_NAME}$"; then docker network rm '${HomelabContainer.PROXY_STACK_NAME}'; fi`,
            addPreviousOutputInEnv: false,
            connection,
          },
          {
            parent: this.container,
            dependsOn: this.provisionerResources,
            deleteBeforeReplace: true,
          },
        );
      }

      this.createRemoteOutputRootDir = new command.remote.Command(
        `${name}-create-pulumi-root-output-dir`,
        {
          create: `mkdir -p ${TemplateProcessor.REMOTE_OUTPUT_FOLDER_ROOT}`,
          delete: `rm -rf ${TemplateProcessor.REMOTE_OUTPUT_FOLDER_ROOT}`,
          addPreviousOutputInEnv: false,
          connection,
        },
        {
          parent: this.container,
          dependsOn: this.proxyNetwork ?? this.provisionerResources,
        },
      );

      const { provider, ...lxcConfig } = args;
      provider.pveConfig.apply((pveConfig) => {
        for (const stackName of stackNames) {
          this.stacks.push(
            new ComposeStack(
              `${name}-${stackName}`,
              {
                stackName,
                connection,
                lxcConfig,
                pveConfig,
              },
              {
                parent: this.container,
                dependsOn: this.createRemoteOutputRootDir,
                // hooks: {
                //   afterCreate: [(args) => console.dir(args, { depth: Infinity })],
                //   afterUpdate: [(args) => console.dir(args, { depth: Infinity })]
                // }
              },
            ),
          );
        }
      });
    }

    this.registerOutputs();
  }
}
