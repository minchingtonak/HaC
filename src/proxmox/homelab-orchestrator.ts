import { snakeToCamelKeys } from "@hac/schema/case-conversion";

import { TemplateContext } from "@hac/templates/template-context";

import {
  pveConfigParser,
  logFileParseErrors,
} from "../hosts/host-config-parser";
import { HomelabPveHost, HomelabPveHostContext } from "./homelab-pve-host";

export function deployHomelab() {
  const pveConfigResults = pveConfigParser.loadAllConfigs("./hosts/pve");

  pveConfigResults.apply(([pveConfigs, parseErrors]) => {
    logFileParseErrors(parseErrors);

    const enabledConfigs = pveConfigs.filter((c) => c.enabled);
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
