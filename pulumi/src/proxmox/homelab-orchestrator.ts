import * as pulumi from '@pulumi/pulumi';
import { HomelabPveHost } from './homelab-pve-host';
import { PveHostConfigParser } from '../hosts/pve-host-config-parser';

export function deployHomelab() {
  const pveConfigs = PveHostConfigParser.loadAllPveHostConfigs('./hosts/pve');

  pulumi.all(pveConfigs).apply((configs) => {
    for (const pveConfig of configs) {
      new HomelabPveHost(`pve-${pveConfig.pve.node}`, {
        pveHostConfig: pveConfig,
      });
    }
  });
}
