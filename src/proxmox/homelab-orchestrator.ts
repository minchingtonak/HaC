import * as pulumi from "@pulumi/pulumi";
import { HomelabPveHost, HomelabPveHostContext } from "./homelab-pve-host";
import { PveHostConfigParser } from "../hosts/pve-host-config-parser";
import { TemplateContext } from "../templates/template-context";
import { snakeToCamelKeys } from "../utils/schema-utils";

export function deployHomelab() {
  const pveConfigs = PveHostConfigParser.loadAllPveHostConfigs("./hosts/pve");

  pulumi.all(pveConfigs).apply((configs) => {
    const enabledConfigs = configs.filter((c) => c.enabled);
    const camelCasedEnabledConfigs = enabledConfigs.map((config) =>
      snakeToCamelKeys(config, ["variables", "environment"]),
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
