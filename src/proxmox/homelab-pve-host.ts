import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as command from "@pulumi/command/remote";
import { HomelabContainer, HomelabContainerContext } from "./homelab-container";
import { HomelabPveProvider } from "./homelab-pve-provider";
import { LxcHostConfigParser } from "../hosts/lxc-host-config-parser";
import { PveFirewallPolicy } from "../constants";
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
  public readonly firewall: proxmox.network.Firewall;
  public readonly templateFile: proxmox.download.File;
  public readonly containers: HomelabContainer[] = [];

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

    this.firewall = new proxmox.network.Firewall(
      `${name}-firewall`,
      {
        enabled: true,
        ebtables: true,
        inputPolicy: PveFirewallPolicy.DROP,
        outputPolicy: PveFirewallPolicy.ACCEPT,
        logRatelimit: { enabled: true, rate: "1/second", burst: 5 },
      },
      { provider: this.provider },
    );

    this.templateFile = new proxmox.download.File(
      `${name}-debian-12-lxc-template`,
      {
        nodeName: pveConfig.node,
        datastoreId: pveConfig.storage.templates,
        // TODO add download file to pve config schema
        contentType: "vztmpl",
        url: "http://download.proxmox.com/images/system/debian-12-standard_12.7-1_amd64.tar.zst",
        checksum:
          "39f6d06e082d6a418438483da4f76092ebd0370a91bad30b82ab6d0f442234d63fe27a15569895e34d6d1e5ca50319f62637f7fb96b98dbde4f6103cf05bff6d",
        checksumAlgorithm: "sha512",
        overwriteUnmanaged: true,
      },
      { provider: this.provider, retainOnDelete: true, parent: this },
    );

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
              host: pveConfig.dns.domain,
              privateKey: pveConfig.lxc.ssh.privateKey,
            },
          },
          { parent: this, dependsOn: this.templateFile, retainOnDelete: true },
        );

        const container = new HomelabContainer(
          `${name}-${config.hostname}`,
          {
            context: args.context.withData<HomelabContainerContext>({
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

    this.registerOutputs({
      provider: this.provider,
      templateFile: this.templateFile,
      containers: this.containers,
    });
  }
}
