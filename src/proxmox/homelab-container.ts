import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as porkbun from "@pulumi/porkbun";
import {
  PveFirewallDirection,
  PveFirewallMacro,
  PveFirewallPolicy,
} from "../constants";
import { HomelabPveProvider } from "./homelab-pve-provider";
import { ComposeStack, ComposeStackContext } from "../docker/compose-stack";
import {
  ProvisionerEngine,
  ProvisionerResource,
} from "../hosts/provisioner-engine";
import { TemplateProcessor } from "../templates/template-processor";
import { TemplateContext } from "../templates/template-context";
import { type HomelabPveHostContext } from "./homelab-pve-host";

export type HomelabContainerContext = HomelabPveHostContext & {
  stackName: string;
};

export type HomelabContainerArgs = {
  context: TemplateContext<HomelabContainerContext>;
  provider: HomelabPveProvider;
};

export class HomelabContainer extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = "HaC:proxmoxve:HomelabContainer";

  private static CONTAINER_SUBDOMAIN = (hostname: string, nodeName: string) =>
    `${hostname}.pulumi.${nodeName}`;

  private static PROXY_STACK_NAME = "traefik";

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

    const { lxcConfig, pveConfig } = args.context.get("lxcConfig", "pveConfig");

    const ctAddress = pulumi.interpolate`${pveConfig.lxc.network.subnet}.${lxcConfig.id}`;
    const ctCidr = pulumi.interpolate`${ctAddress}/24`;

    const mountPoints =
      lxcConfig.mountPoints?.map((mp) => ({
        volume: mp.volume,
        path: mp.mountPoint,
        size: mp.size ? `${mp.size}G` : undefined,
        acl: mp.acl,
        backup: mp.backup,
        quota: mp.quota,
        replicate: mp.replicate,
        shared: mp.shared,
      })) ?? [];

    const stackNames = Object.keys(lxcConfig.stacks ?? {});

    this.container = new proxmox.ct.Container(
      name,
      {
        nodeName: pveConfig.node,
        vmId: lxcConfig.id,
        description: lxcConfig.description,
        tags: [...stackNames, ...(lxcConfig.tags ?? [])],
        unprivileged: lxcConfig.unprivileged,
        startOnBoot: lxcConfig.startOnBoot,
        protection: lxcConfig.protection,
        operatingSystem: lxcConfig.os,
        mountPoints: mountPoints,
        devicePassthroughs: lxcConfig.devicePassthroughs,
        initialization: {
          hostname: lxcConfig.hostname,
          ipConfigs: [
            {
              ipv4: { address: ctCidr, gateway: pveConfig.lxc.network.gateway },
            },
          ],
          userAccount: {
            keys: [pveConfig.lxc.ssh.publicKey],
            password: pveConfig.lxc.auth.password,
          },
        },
        networkInterfaces: lxcConfig.networkInterfaces,
        cpu: lxcConfig.cpu,
        memory: lxcConfig.memory,
        disk: lxcConfig.disk,
        features: lxcConfig.features,
        console: lxcConfig.console,
      },
      { provider: args.provider, parent: this, deleteBeforeReplace: true },
    );

    this.firewallOptions = new proxmox.network.FirewallOptions(
      `${name}-fw-options`,
      {
        nodeName: pveConfig.node,
        containerId: lxcConfig.id,
        ...lxcConfig.firewallOptions,
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
        nodeName: pveConfig.node,
        containerId: lxcConfig.id,
        name: fwAliasName,
        cidr: ctCidr,
        comment: "created by pulumi",
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
        nodeName: pveConfig.node,
        containerId: lxcConfig.id,
        rules: [
          {
            enabled: true,
            type: PveFirewallDirection.in,
            action: PveFirewallPolicy.ACCEPT,
            macro: PveFirewallMacro.SSH,
          },
          ...(hasProxy ?
            [
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
          ...(lxcConfig.firewallRules ?? []),
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
      apiKey: pveConfig.providers.dns?.porkbun?.apiKey,
      secretKey: pveConfig.providers.dns?.porkbun?.secretKey,
    });

    this.baseDnsRecord = new porkbun.DnsRecord(
      `${name}-base-dns-record`,
      {
        domain: pveConfig.lxc.network.domain,
        subdomain: HomelabContainer.CONTAINER_SUBDOMAIN(
          lxcConfig.hostname,
          pveConfig.node,
        ),
        content: ctAddress,
        type: "A",
      },
      { parent: this, provider: porkbunProvider, deleteBeforeReplace: true },
    );

    this.wildcardDnsRecord = new porkbun.DnsRecord(
      `${name}-wildcard-dns-record`,
      {
        domain: pveConfig.lxc.network.domain,
        subdomain: `*.${HomelabContainer.CONTAINER_SUBDOMAIN(lxcConfig.hostname, pveConfig.node)}`,
        content: ctAddress,
        type: "A",
      },
      { parent: this, provider: porkbunProvider, deleteBeforeReplace: true },
    );

    const connection: command.types.input.remote.ConnectionArgs = {
      host: ctAddress,
      user: "root",
      privateKey: pveConfig.lxc.ssh.privateKey,
    };

    if (lxcConfig.provisioners && lxcConfig.provisioners.length > 0) {
      const provisionerEngine = new ProvisionerEngine({ name, connection });

      this.provisionerResources = provisionerEngine.executeProvisioners(
        lxcConfig.provisioners,
        this.container,
      );
    }

    if (lxcConfig.stacks) {
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

      for (const stackName of stackNames) {
        this.stacks.push(
          new ComposeStack(
            `${name}-${stackName}`,
            {
              connection,
              context: args.context.withData<ComposeStackContext>({
                stackName,
              }),
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
    }

    this.registerOutputs();
  }
}
