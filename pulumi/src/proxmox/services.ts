import * as path from 'node:path';
import { HomelabContainer } from './homelab-container';
import { HostConfigParser } from './host-config-parser';

export function deployContainers() {
  const hostsDir = path.join(__dirname, '../../hosts');
  const hostConfigs = HostConfigParser.loadAllHostConfigs(hostsDir);

  return hostConfigs
    .filter((host) => host.enabled)
    .map(
      (host) => new HomelabContainer(`${host.hostname}-homelab-container`, host),
    );
}
