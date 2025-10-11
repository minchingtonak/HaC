import * as pulumi from "@pulumi/pulumi";
import { HomelabPveHost } from "./homelab-pve-host";
import { PveHostConfigParser } from "../hosts/pve-host-config-parser";

export function deployHomelab() {
  const pveConfigs = PveHostConfigParser.loadAllPveHostConfigs("./hosts/pve");

  pulumi.all(pveConfigs).apply((configs) => {
    const enabledConfigs = configs.filter((c) => c.enabled);
    for (const pveConfig of enabledConfigs) {
      new HomelabPveHost(pveConfig.node, { pveHostConfig: pveConfig });
    }
  });
}
