import { TemplateContext } from "@hac/templates/template-context";

import {
  HomelabPveHost,
  HomelabPveHostContext,
} from "./resources/proxmox/homelab-pve-host";
import { pveConfigParser } from "./config-parser/parsers";
import { logFileParseErrors } from "./config-parser/utils";

export default function deployHomelab() {
  const pveConfigResults = pveConfigParser.loadAllConfigs("./hosts/pve");

  pveConfigResults.apply(([pveConfigs, parseErrors]) => {
    logFileParseErrors(parseErrors);

    const enabledConfigs = pveConfigs.filter((c) => c.enabled);
    const context = new TemplateContext<HomelabPveHostContext>({
      enabledPveHosts: enabledConfigs,
    });

    for (const pveConfig of enabledConfigs) {
      new HomelabPveHost(pveConfig.node, {
        context: context.withData({ pveConfig }),
      });
    }
  });
}
