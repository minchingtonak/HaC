import * as pulumi from "@pulumi/pulumi";

import { snakeToCamelKeys } from "@hac/schema/case-conversion";

import { TemplateContext } from "@hac/templates/template-context";

import { pveConfigParser } from "../hosts/host-config-parser";
import { PveHostConfigToml } from "../hosts/schema/pve-host-config";
import { HomelabPveHost, HomelabPveHostContext } from "./homelab-pve-host";

export function deployHomelab() {
  const pveResults = pveConfigParser.loadAllConfigs("./hosts/pve");

  pulumi.all(pveResults).apply((results) => {
    const configs: PveHostConfigToml[] = [];
    for (const result of results) {
      if (result.success) {
        configs.push(result.data);
      } else {
        pulumi.log.warn(`Failed to parse PVE config: ${result.error.message}`);
      }
    }

    const enabledConfigs = configs.filter((c) => c.enabled);
    const camelCasedEnabledConfigs = enabledConfigs.map((config) =>
      snakeToCamelKeys(config, { ignoreFields: ["variables", "environment"] }),
    );
    const context = new TemplateContext<HomelabPveHostContext>({
      enabled_pve_hosts: enabledConfigs,
      enabledPveHosts: camelCasedEnabledConfigs,
    });

    for (let i = 0; i < enabledConfigs.length; ++i) {
      const pveConfig = enabledConfigs[i];
      const camelCasedPveConfig = camelCasedEnabledConfigs[i];

      new HomelabPveHost(pveConfig.node, {
        context: context.withData({
          pve_config: pveConfig,
          pveConfig: camelCasedPveConfig,
        }),
      });
    }
  });
}
