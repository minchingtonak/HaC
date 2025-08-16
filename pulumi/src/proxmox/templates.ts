import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import { homelabConfig, homelabProvider } from './homelab';

const pveNodeName = homelabConfig.require('pveNodeName');
const imageTemplateDatastoreId = homelabConfig.require(
  'imageTemplateDatastoreId',
);

const debian12TemplateFile = new proxmox.download.File(
  'debian-12-template',
  {
    nodeName: pveNodeName,
    datastoreId: imageTemplateDatastoreId,
    contentType: 'vztmpl',
    url: 'http://download.proxmox.com/images/system/debian-12-standard_12.7-1_amd64.tar.zst',
    checksum:
      '39f6d06e082d6a418438483da4f76092ebd0370a91bad30b82ab6d0f442234d63fe27a15569895e34d6d1e5ca50319f62637f7fb96b98dbde4f6103cf05bff6d',
    checksumAlgorithm: 'sha512',
    overwriteUnmanaged: true,
  },
  { provider: homelabProvider, retainOnDelete: true },
);

export const debian12: proxmox.types.input.CT.ContainerOperatingSystem = {
  type: 'debian',
  templateFileId: debian12TemplateFile.id,
};
