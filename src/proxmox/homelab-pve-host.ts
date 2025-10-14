import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as command from "@pulumi/command/remote";
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
import { type TemplateFileContext } from "../docker/compose-stack";
import { TemplateProcessor } from "../templates/template-processor";

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

  static LXC_HOST_CONFIG_PATH_FOR = (hostname: string) =>
    `./hosts/lxc/${hostname}.hbs.toml`;

  public readonly provider: HomelabPveProvider;
  public readonly dns?: proxmox.DNS;
  public readonly firewall?: proxmox.network.Firewall;
  public readonly files?: proxmox.download.File[];
  public readonly metricsServers?: proxmox.metrics.MetricsServer[];
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
      const camelCasedConfigs = hostConfigs.map(snakeToCamelKeys);
      for (let i = 0; i < hostConfigs.length; ++i) {
        const config = hostConfigs[i];
        const camelCasedConfig = camelCasedConfigs[i];

        const appDataDirPath = path.join(
          pveConfig.lxc.appDataDir,
          config.hostname,
        );

        const createAppDataDir = new command.Command(
          `${name}-${config.hostname}-appdata-dir`,
          {
            create: `mkdir -p ${appDataDirPath} && chmod 777 ${appDataDirPath}`,
            delete: `rm -rf ${appDataDirPath}`,
            connection: {
              // TODO user: pve.auth.username,
              user: "root",
              host: pveConfig.ip,
              privateKey: pveConfig.lxc.ssh.privateKey,
            },
          },
          {
            parent: this,
            dependsOn: this.metricsServers ?? this.files ?? this.dns,
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
