import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as command from "@pulumi/command/remote";
import { HomelabContainer } from "./homelab-container";
import { HomelabProvider } from "./homelab-provider";
import { LxcHostConfigParser } from "../hosts/lxc-host-config-parser";
import { PveHostConfigToml } from "../hosts/pve-host-config-schema";
import { PveFirewallPolicy } from "../constants";
import path from "node:path";

export interface HomelabPveHostArgs {
  pveHostConfig: PveHostConfigToml;
}

export class HomelabPveHost extends pulumi.ComponentResource {
  public static RESOURCE_TYPE = "HaC:proxmoxve:HomelabPveHost";

  static LXC_HOST_CONFIG_PATH_FOR = (hostname: string) =>
    `./hosts/lxc/${hostname}.hbs.toml`;

  public readonly provider: HomelabProvider;
  public readonly firewall: proxmox.network.Firewall;
  public readonly templateFile: proxmox.download.File;
  public readonly containers: HomelabContainer[] = [];

  constructor(
    name: string,
    args: HomelabPveHostArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(HomelabPveHost.RESOURCE_TYPE, name, {}, opts);

    this.provider = new HomelabProvider(
      `${name}-provider`,
      { pveHostConfig: args.pveHostConfig },
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
        nodeName: this.provider.pveNodeName,
        datastoreId: this.provider.imageTemplateDatastoreId,
        contentType: "vztmpl",
        url: "http://download.proxmox.com/images/system/debian-12-standard_12.7-1_amd64.tar.zst",
        checksum:
          "39f6d06e082d6a418438483da4f76092ebd0370a91bad30b82ab6d0f442234d63fe27a15569895e34d6d1e5ca50319f62637f7fb96b98dbde4f6103cf05bff6d",
        checksumAlgorithm: "sha512",
        overwriteUnmanaged: true,
      },
      { provider: this.provider, retainOnDelete: true, parent: this },
    );

    const enabledHostnames = Object.keys(args.pveHostConfig.lxc.hosts).filter(
      (hostname) => args.pveHostConfig.lxc.hosts[hostname].enabled,
    );

    const referencedHostConfigs = enabledHostnames.map((hostname) => {
      const hostConfigPath = HomelabPveHost.LXC_HOST_CONFIG_PATH_FOR(hostname);
      return LxcHostConfigParser.parseHostConfigFile(hostConfigPath, {
        pve: args.pveHostConfig,
      });
    });

    this.provider.pveConfig.apply((pveConfig) => {
      pulumi.all(referencedHostConfigs).apply((hostConfigs) => {
        for (const config of hostConfigs) {
          const appDataDirPath = path.join(
            pveConfig.lxc.appDataDirectory,
            config.hostname,
          );

          const createAppDataDir = new command.Command(
            `${name}-${config.hostname}-appdata-dir`,
            {
              create: `mkdir -p ${appDataDirPath} && chmod 777 ${appDataDirPath}`,
              delete: `rm -rf ${appDataDirPath}`,
              connection: {
                user: "root",
                host: pveConfig.dns.domain,
                privateKey: this.provider.lxcPrivateSshKey,
              },
            },
            {
              parent: this,
              dependsOn: this.templateFile,
              retainOnDelete: true,
            },
          );

          const container = new HomelabContainer(
            `${name}-${config.hostname}`,
            { ...config, provider: this.provider },
            { dependsOn: createAppDataDir, parent: this },
          );

          this.containers.push(container);
        }
      });
    });

    this.registerOutputs({
      provider: this.provider,
      templateFile: this.templateFile,
      containers: this.containers,
    });
  }
}
