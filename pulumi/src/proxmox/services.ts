import * as path from 'node:path';
import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import { HomelabContainer } from './homelab-container';
import { HostConfigParser } from './host-config-parser';
import { HomelabProvider } from './homelab-provider';

export function deployContainers(provider: HomelabProvider) {
  const hostsDir = path.join(__dirname, '../../hosts');
  const hostConfigs = HostConfigParser.loadAllHostConfigs(hostsDir);

  const templateFile = new proxmox.download.File(
    'debian-12-template',
    {
      nodeName: provider.pveNodeName,
      datastoreId: provider.imageTemplateDatastoreId,
      contentType: 'vztmpl',
      url: 'http://download.proxmox.com/images/system/debian-12-standard_12.7-1_amd64.tar.zst',
      checksum:
        '39f6d06e082d6a418438483da4f76092ebd0370a91bad30b82ab6d0f442234d63fe27a15569895e34d6d1e5ca50319f62637f7fb96b98dbde4f6103cf05bff6d',
      checksumAlgorithm: 'sha512',
      overwriteUnmanaged: true,
    },
    { provider: provider, retainOnDelete: true },
  );

  for (const config of hostConfigs) {
    if (!config.enabled) {
      return;
    }

    new HomelabContainer(
      `${config.hostname}-homelab-container`,
      {
        ...config,
        provider,
      },
      {
        dependsOn: templateFile,
      },
    );
  }
}
