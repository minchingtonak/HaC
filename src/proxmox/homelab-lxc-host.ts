import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as porkbun from "@pulumi/porkbun";
import { HomelabPveProvider } from "./homelab-pve-provider";
import {
  ComposeStack,
  ComposeStackContext,
  TemplateFileContext,
} from "../docker/compose-stack";
import {
  ProvisionerEngine,
  ProvisionerResource,
} from "../hosts/provisioner-engine";
import { TemplateProcessor } from "../templates/template-processor";
import { TemplateContext } from "../templates/template-context";
import { type HomelabPveHostContext } from "./homelab-pve-host";
import { LXC_DEFAULTS } from "../hosts/schema/pve";
import { FirewallDirection, FirewallMacro, FirewallPolicy } from "../constants";

export type HomelabLxcHostContext = HomelabPveHostContext & {
  stackName: string;
};

export type HomelabLxcHostArgs = {
  context: TemplateContext<HomelabLxcHostContext>;
  provider: HomelabPveProvider;
};

export class HomelabLxcHost extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = "HaC:proxmoxve:HomelabContainer";

  /**
   * Returns the domain of the container, minus the root domain (i.e. test.com)
   */
  public static CONTAINER_SUBDOMAIN = (hostname: string, nodeName: string) =>
    `${hostname}.${nodeName}`;

  /**
   * Returns the full domain of the container
   */
  public static CONTAINER_BASE_DOMAIN = (context: TemplateFileContext) =>
    `${HomelabLxcHost.CONTAINER_SUBDOMAIN(context.lxc.hostname, context.pve.node)}.${context.pve.lxc.network.domain}`;

  private static PROXY_STACK_NAME = "traefik";

  public readonly container: proxmox.ct.Container;
  public readonly firewallOptions: proxmox.network.FirewallOptions;
  public readonly firewallAlias: proxmox.network.FirewallAlias;
  public readonly firewallRules: proxmox.network.FirewallRules;
  public readonly provisionerResources?: ProvisionerResource[] = [];
  public readonly proxyNetwork?: command.remote.Command;
  public readonly createRemoteOutputRootDir?: command.remote.Command;
  public readonly stacks: ComposeStack[] = [];
  public readonly baseDnsRecord: porkbun.DnsRecord;
  public readonly wildcardDnsRecord: porkbun.DnsRecord;

  constructor(
    name: string,
    args: HomelabLxcHostArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HomelabLxcHost.RESOURCE_TYPE, name, {}, opts);

    const { lxcConfig, pveConfig } = args.context.get("lxcConfig", "pveConfig");

    const result = Object.entries(pveConfig.lxc.hosts).find(
      ([hostname]) => hostname === lxcConfig.hostname,
    );
    const lxcPveConfig = result?.[1];

    if (!lxcPveConfig) {
      throw new Error(
        `Failed to find LXC host with hostname ${lxcConfig.hostname} in PVE host ${pveConfig.endpoint}`,
      );
    }

    const ctAddress = pulumi.interpolate`${pveConfig.lxc.network.subnet}.${lxcPveConfig.id}`;
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
        vmId: lxcPveConfig.id,
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
        startup: lxcConfig.startup,
        started: lxcConfig.started,
        clone: lxcConfig.clone,
        hookScriptFileId: lxcConfig.hookScriptFileId,
        poolId: lxcConfig.poolId,
        template: lxcConfig.template,
      },
      { provider: args.provider, parent: this, deleteBeforeReplace: true },
    );

    this.firewallOptions = new proxmox.network.FirewallOptions(
      `${name}-fw-options`,
      {
        nodeName: pveConfig.node,
        containerId: lxcPveConfig.id,
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
        containerId: lxcPveConfig.id,
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

    const hasProxy = stackNames.includes(HomelabLxcHost.PROXY_STACK_NAME);

    if (!hasProxy) {
      throw new Error(
        `Container ${name} must use proxy stack ${HomelabLxcHost.PROXY_STACK_NAME}`,
      );
    }

    this.firewallRules = new proxmox.network.FirewallRules(
      `${name}-fw-rules`,
      {
        nodeName: pveConfig.node,
        containerId: lxcPveConfig.id,
        rules: [
          {
            enabled: true,
            type: FirewallDirection.in,
            action: FirewallPolicy.ACCEPT,
            macro: FirewallMacro.SSH,
          },
          ...(hasProxy ?
            [
              {
                enabled: true,
                type: FirewallDirection.in,
                action: FirewallPolicy.ACCEPT,
                macro: FirewallMacro.HTTP,
              },
              {
                enabled: true,
                type: FirewallDirection.in,
                action: FirewallPolicy.ACCEPT,
                macro: FirewallMacro.HTTPS,
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
        subdomain: HomelabLxcHost.CONTAINER_SUBDOMAIN(
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
        subdomain: `*.${HomelabLxcHost.CONTAINER_SUBDOMAIN(lxcConfig.hostname, pveConfig.node)}`,
        content: ctAddress,
        type: "A",
      },
      { parent: this, provider: porkbunProvider, deleteBeforeReplace: true },
    );

    const connection: command.types.input.remote.ConnectionArgs = {
      host: ctAddress,
      // user: pveConfig.lxc.ssh.user,
      user: LXC_DEFAULTS.USER,
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
          `${name}-create-${HomelabLxcHost.PROXY_STACK_NAME}-network`,
          {
            create: `if ! docker network ls --format "{{.Name}}" | grep -q "^${HomelabLxcHost.PROXY_STACK_NAME}$"; then docker network create '${HomelabLxcHost.PROXY_STACK_NAME}'; fi`,
            delete: `if docker network ls --format "{{.Name}}" | grep -q "^${HomelabLxcHost.PROXY_STACK_NAME}$"; then docker network rm '${HomelabLxcHost.PROXY_STACK_NAME}'; fi`,
            addPreviousOutputInEnv: false,
            connection,
          },
          {
            parent: this.container,
            dependsOn: this.provisionerResources ?? this.container,
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

      this.stacks = stackNames.map(
        (stackName) =>
          new ComposeStack(
            `${name}-${stackName}`,
            {
              connection,
              context: args.context.withData<ComposeStackContext>({
                stackName,
                configNamespace: `lxc#${lxcConfig.hostname}#${stackName}`,
              }),
            },
            {
              parent: this.container,
              dependsOn: this.createRemoteOutputRootDir,
            },
          ),
      );
    }

    this.registerOutputs();
  }
}

TemplateProcessor.registerTemplateHelper(
  "domainForContainer",
  (options: Handlebars.HelperOptions) => {
    const context = options.data as TemplateFileContext;

    return HomelabLxcHost.CONTAINER_BASE_DOMAIN(context);
  },
);
