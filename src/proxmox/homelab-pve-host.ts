import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as command from "@pulumi/command";
import { HomelabLxcHost, HomelabLxcHostContext } from "./homelab-lxc-host";
import { HomelabPveProvider } from "./homelab-pve-provider";
import { LxcHostConfigParser } from "../hosts/lxc-host-config-parser";
import path from "node:path";
import { TemplateContext } from "../templates/template-context";
import {
  PveHostConfig,
  PveHostConfigToml,
} from "../hosts/schema/pve-host-config";
import {
  LxcHostConfig,
  LxcHostConfigToml,
} from "../hosts/schema/lxc-host-config";
import { snakeToCamelKeys } from "../utils/schema-utils";
import {
  ComposeStack,
  ComposeStackContext,
  type TemplateFileContext,
} from "../docker/compose-stack";
import { TemplateProcessor } from "../templates/template-processor";
import {
  ProvisionerEngine,
  ProvisionerResource,
} from "../hosts/provisioner-engine";

/**
 * a camelCase version of all properties is provided for ease of
 * interoperability with the Pulumi pve resource APIs
 */
export type HomelabPveHostContext = {
  pve_config: PveHostConfigToml;
  pveConfig: PveHostConfig;
  enabled_pve_hosts: PveHostConfigToml[];
  enabledPveHosts: PveHostConfig[];
  lxc_config: LxcHostConfigToml;
  lxcConfig: LxcHostConfig;
  enabled_lxc_hosts: LxcHostConfigToml[];
  enabledLxcHosts: LxcHostConfig[];
};

export interface HomelabPveHostArgs {
  context: TemplateContext<HomelabPveHostContext>;
}

export class HomelabPveHost extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = "HaC:proxmoxve:HomelabPveHost";

  private static PROXY_STACK_NAME = "traefik";

  static LXC_HOST_CONFIG_PATH_FOR = (hostname: string) =>
    `./hosts/lxc/${hostname}.hbs.toml`;

  public readonly provider: HomelabPveProvider;
  public readonly dns?: proxmox.DNS;
  public readonly firewall?: proxmox.network.Firewall;
  public readonly files?: proxmox.download.File[];
  public readonly metricsServers?: proxmox.metrics.MetricsServer[];
  public readonly provisionerResources?: ProvisionerResource[];
  public readonly proxyNetwork?: command.remote.Command;
  public readonly createRemoteOutputRootDir?: command.remote.Command;
  public readonly stacks: ComposeStack[] = [];
  public readonly containers: HomelabLxcHost[] = [];

  constructor(
    name: string,
    args: HomelabPveHostArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HomelabPveHost.RESOURCE_TYPE, name, {}, opts);

    const { pveConfig, pve_config, enabled_pve_hosts } = args.context.get(
      "pveConfig",
      "pve_config",
      "enabled_pve_hosts",
    );

    this.provider = new HomelabPveProvider(
      `${name}-provider`,
      { pveConfig: pveConfig },
      { parent: this },
    );

    if (pveConfig.dns) {
      this.dns = new proxmox.DNS(`${name}-dns`, {
        nodeName: pveConfig.node,
        domain: pveConfig.dns.domain,
        servers: pveConfig.dns.servers,
      });
    }

    if (pveConfig.firewall) {
      this.firewall = new proxmox.network.Firewall(
        `${name}-firewall`,
        pveConfig.firewall,
        { provider: this.provider },
      );
    }

    this.files = pveConfig.files?.map((file) => {
      const url = new URL(file.url);
      const sanitizedName = TemplateProcessor.buildSanitizedNameForId(
        `${url.host}${url.pathname}`,
      );

      return new proxmox.download.File(
        `${name}-file-${sanitizedName}`,
        { nodeName: pveConfig.node, ...file },
        {
          provider: this.provider,
          retainOnDelete: file.retainOnDelete,
          parent: this,
        },
      );
    });

    this.metricsServers = pveConfig.metricsServers?.map((server) => {
      return new proxmox.metrics.MetricsServer(
        `${name}-${server.type}`,
        server,
        { provider: this.provider, parent: this },
      );
    });

    const connection: command.types.input.remote.ConnectionArgs = {
      host: pveConfig.ip,
      user: pveConfig.ssh.user,
      privateKey: pveConfig.ssh.privateKey,
    };

    if (pveConfig.provisioners && pveConfig.provisioners.length > 0) {
      const provisionerEngine = new ProvisionerEngine({ name, connection });

      this.provisionerResources = provisionerEngine.executeProvisioners(
        pveConfig.provisioners,
        this,
      );
    }

    const stackNames = Object.keys(pveConfig.stacks ?? {});

    const hasProxy = stackNames.includes(HomelabPveHost.PROXY_STACK_NAME);

    if (pveConfig.stacks) {
      if (hasProxy) {
        this.proxyNetwork = new command.remote.Command(
          `${name}-create-${HomelabPveHost.PROXY_STACK_NAME}-network`,
          {
            create: `if ! docker network ls --format "{{.Name}}" | grep -q "^${HomelabPveHost.PROXY_STACK_NAME}$"; then docker network create '${HomelabPveHost.PROXY_STACK_NAME}'; fi`,
            delete: `if docker network ls --format "{{.Name}}" | grep -q "^${HomelabPveHost.PROXY_STACK_NAME}$"; then docker network rm '${HomelabPveHost.PROXY_STACK_NAME}'; fi`,
            addPreviousOutputInEnv: false,
            connection,
          },
          {
            parent: this,
            dependsOn: this.provisionerResources ?? this,
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
          parent: this,
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
                configNamespace: `pve#${pveConfig.node}#${stackName}`,
                // for now, stub out lxc context var
                lxc_config: {} as LxcHostConfigToml,
                enabled_lxc_hosts: [],
                lxcConfig: {} as LxcHostConfig,
                enabledLxcHosts: [],
              }),
            },
            { parent: this, dependsOn: this.createRemoteOutputRootDir },
          ),
      );
    }

    const enabledHostnames = Object.keys(pveConfig.lxc.hosts).filter(
      (hostname) => pveConfig.lxc.hosts[hostname].enabled,
    );

    const enabledLxcConfigs = enabledHostnames.map((hostname) => {
      const hostConfigPath = HomelabPveHost.LXC_HOST_CONFIG_PATH_FOR(hostname);
      return LxcHostConfigParser.parseHostConfigFile<
        Pick<TemplateFileContext, "pve" | "pve_hosts">
      >(hostConfigPath, { pve: pve_config, pve_hosts: enabled_pve_hosts });
    });

    pulumi.all(enabledLxcConfigs).apply((hostConfigs) => {
      const camelCasedConfigs = hostConfigs.map((config) =>
        snakeToCamelKeys(config, ["variables", "environment"]),
      );
      for (let i = 0; i < hostConfigs.length; ++i) {
        const config = hostConfigs[i];
        const camelCasedConfig = camelCasedConfigs[i];

        const appDataDirPath = path.join(
          pveConfig.lxc.appDataDir,
          config.hostname,
        );

        const createAppDataDir = new command.remote.Command(
          `${name}-${config.hostname}-appdata-dir`,
          {
            create: `mkdir -p ${appDataDirPath} && chmod 777 ${appDataDirPath}`,
            delete: `rm -rf ${appDataDirPath}`,
            connection,
          },
          {
            parent: this,
            dependsOn:
              this.stacks ?? this.metricsServers ?? this.files ?? this.dns,
            retainOnDelete: true,
          },
        );

        const container = new HomelabLxcHost(
          `${name}-${config.hostname}`,
          {
            context: args.context.withData<HomelabLxcHostContext>({
              lxc_config: config,
              enabled_lxc_hosts: hostConfigs,
              lxcConfig: camelCasedConfig,
              enabledLxcHosts: camelCasedConfigs,
            }),
            provider: this.provider,
          },
          { dependsOn: createAppDataDir, parent: this },
        );

        this.containers.push(container);
      }
    });

    this.registerOutputs({ files: this.files, containers: this.containers });
  }
}
