import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import * as pulumi from '@pulumi/pulumi';
import { HomelabContainer } from './homelab-container';
import { HostConfigParser } from '../hosts/host-config-parser';
import { HomelabProvider } from './homelab-provider';
import { HostConfigToml } from '../hosts/host-config-schema';

export function deployContainers(provider: HomelabProvider) {
  const hostConfigs = HostConfigParser.loadAllHostConfigs('./hosts');

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

  function processConfigs(hostConfigs: HostConfigToml[]) {
    for (const config of hostConfigs) {
      if (!config.enabled) {
        continue;
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

  pulumi.all(hostConfigs).apply(processConfigs);
}
