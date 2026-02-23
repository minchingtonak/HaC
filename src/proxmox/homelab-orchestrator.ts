import { TemplateContext } from "@hac/templates/template-context";

import { logFileParseErrors } from "../hosts/config-parser";
import { pveConfigParser } from "../hosts/pve-config-parser";
import { HomelabPveHost, HomelabPveHostContext } from "./homelab-pve-host";

export function deployHomelab() {
  const pveConfigResults = pveConfigParser.loadAllConfigs("./hosts/pve");

  pveConfigResults.apply(([pveConfigs, parseErrors]) => {
    logFileParseErrors(parseErrors);

    const enabledConfigs = pveConfigs.filter((c) => c.enabled);
    const context = new TemplateContext<HomelabPveHostContext>({
      enabled_pve_hosts: enabledConfigs,
    });

    for (const pveConfig of enabledConfigs) {
      new HomelabPveHost(pveConfig.node, {
        context: context.withData({ pve_config: pveConfig }),
      });
    }
  });
}
