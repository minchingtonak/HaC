import { HomelabProvider } from './src/proxmox/homelab-provider';
import { deployContainers } from './src/proxmox/services';

function main() {
  const homelabProvider = new HomelabProvider('homelab-pve');

  deployContainers(homelabProvider);
}

main();
