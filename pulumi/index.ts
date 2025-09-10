import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import { HomelabProvider } from './src/proxmox/homelab-provider';
import { deployContainers } from './src/proxmox/services';
import {
  ProxmoxFirewallLogLevel,
  ProxmoxFirewallPolicy,
} from './src/constants';

function main() {
  const homelabProvider = new HomelabProvider('homelab-pve');

  new proxmox.network.Firewall(
    'cluster-firewall',
    {
      enabled: true,
      ebtables: true,
      inputPolicy: ProxmoxFirewallPolicy.DROP,
      outputPolicy: ProxmoxFirewallPolicy.ACCEPT,
      logRatelimit: {
        enabled: true,
        rate: '1/second',
        burst: 5,
      },
    },
    {
      provider: homelabProvider,
    },
  );

  deployContainers(homelabProvider);
}

main();
