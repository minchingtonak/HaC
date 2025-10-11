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
import {
  ComposeStack,
  ComposeStackTemplateContext,
} from "../docker/compose-stack";
import {
  ProvisionerEngine,
  ProvisionerResource,
} from "../hosts/provisioner-engine";
import { TemplateProcessor } from "../templates/template-processor";
import { TemplateContext } from "../templates/template-context";
import { type HomelabPveHostTemplateContext } from "./homelab-pve-host";

export type HomelabContainerTemplateContext = HomelabPveHostTemplateContext & {
  stackName: string;
};

export type HomelabContainerArgs = {
  context: TemplateContext<HomelabContainerTemplateContext>;
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

    const { lxc, pve } = args.context.get("lxc", "pve");

    const ctAddress = pulumi.interpolate`${pve.lxc.network.subnet}.${lxc.id}`;
    const ctCidr = pulumi.interpolate`${ctAddress}/24`;

    const mountPoints =
      lxc.mountPoints?.map((mp) => ({
        volume: mp.volume,
        path: mp.mountPoint,
        size: mp.size ? `${mp.size}G` : undefined,
        acl: mp.acl,
        backup: mp.backup,
        quota: mp.quota,
        replicate: mp.replicate,
        shared: mp.shared,
      })) ?? [];

    const stackNames = Object.keys(lxc.stacks ?? {});

    this.container = new proxmox.ct.Container(
      name,
      {
        nodeName: pve.node,
        vmId: lxc.id,
        description: lxc.description,
        tags: [...stackNames, ...(lxc.tags ?? [])],
        unprivileged: lxc.unprivileged,
        startOnBoot: lxc.startOnBoot,
        protection: lxc.protection,
        operatingSystem: lxc.os,
        mountPoints: mountPoints,
        devicePassthroughs: lxc.devicePassthroughs,
        initialization: {
          hostname: lxc.hostname,
          ipConfigs: [
            { ipv4: { address: ctCidr, gateway: pve.lxc.network.gateway } },
          ],
          userAccount: {
            keys: [pve.lxc.ssh.publicKey],
            password: pve.lxc.auth.password,
          },
        },
        networkInterfaces: lxc.networkInterfaces,
        cpu: lxc.cpu,
        memory: lxc.memory,
        disk: lxc.disk,
        features: lxc.features,
        console: lxc.console,
      },
      { provider: args.provider, parent: this, deleteBeforeReplace: true },
    );

    this.firewallOptions = new proxmox.network.FirewallOptions(
      `${name}-fw-options`,
      { nodeName: pve.node, containerId: lxc.id, ...lxc.firewallOptions },
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
        nodeName: pve.node,
        containerId: lxc.id,
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
        nodeName: pve.node,
        containerId: lxc.id,
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
          ...(lxc.firewallRules ?? []),
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
      apiKey: pve.providers.dns?.porkbun?.apiKey,
      secretKey: pve.providers.dns?.porkbun?.secretKey,
    });

    this.baseDnsRecord = new porkbun.DnsRecord(
      `${name}-base-dns-record`,
      {
        domain: pve.lxc.network.domain,
        subdomain: HomelabContainer.CONTAINER_SUBDOMAIN(lxc.hostname, pve.node),
        content: ctAddress,
        type: "A",
      },
      { parent: this, provider: porkbunProvider, deleteBeforeReplace: true },
    );

    this.wildcardDnsRecord = new porkbun.DnsRecord(
      `${name}-wildcard-dns-record`,
      {
        domain: pve.lxc.network.domain,
        subdomain: `*.${HomelabContainer.CONTAINER_SUBDOMAIN(lxc.hostname, pve.node)}`,
        content: ctAddress,
        type: "A",
      },
      { parent: this, provider: porkbunProvider, deleteBeforeReplace: true },
    );

    const connection: command.types.input.remote.ConnectionArgs = {
      host: ctAddress,
      user: "root",
      privateKey: pve.lxc.ssh.privateKey,
    };

    if (lxc.provisioners && lxc.provisioners.length > 0) {
      const provisionerEngine = new ProvisionerEngine({ name, connection });

      this.provisionerResources = provisionerEngine.executeProvisioners(
        lxc.provisioners,
        this.container,
      );
    }

    if (lxc.stacks) {
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
              context: args.context.withData<ComposeStackTemplateContext>({
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
