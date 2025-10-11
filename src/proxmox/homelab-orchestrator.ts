import * as pulumi from "@pulumi/pulumi";
import {
  HomelabPveHost,
  HomelabPveHostTemplateContext,
} from "./homelab-pve-host";
import { PveHostConfigParser } from "../hosts/pve-host-config-parser";
import { TemplateContext } from "../templates/template-context";

export function deployHomelab() {
  const pveConfigs = PveHostConfigParser.loadAllPveHostConfigs("./hosts/pve");

  pulumi.all(pveConfigs).apply((configs) => {
    const enabledConfigs = configs.filter((c) => c.enabled);
    const context = new TemplateContext<HomelabPveHostTemplateContext>({
      enabledPveHosts: enabledConfigs,
    });

    for (const pveConfig of enabledConfigs) {
      new HomelabPveHost(pveConfig.node, {
        context: context.withData({ pve: pveConfig }),
      });
    }
  });
}
