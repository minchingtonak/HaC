import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import * as pulumi from '@pulumi/pulumi';

export const homelabConfig = new pulumi.Config('homelab-pve');

export const homelabProvider = new proxmox.Provider('homelab-pve', {
  endpoint: homelabConfig.require('pveEndpoint'),
  insecure: homelabConfig.requireBoolean('pveInsecure'),
  username: homelabConfig.requireSecret('pveUsername'),
  password: homelabConfig.requireSecret('pvePassword'),
});
