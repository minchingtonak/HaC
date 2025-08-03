import * as pulumi from '@pulumi/pulumi';
import * as proxmoxve from '@muhlba91/pulumi-proxmoxve';

import { ProxmoxFirewallMacro } from '../constants';


// example: https://github.com/Michaelpalacce/HomeLab-IaC/blob/36c4cc3e2f17e9a723f2c81779d2c4da56a34072/security-prod-homelab-proxmox-firewall_security_groups.tf
// https://github.com/RyanNgWH/homelab-opentofu-templates/blob/d81796fdc6c267d2d984afb4234365b320bd425b/proxmox-firewall-instances.tf
// https://github.com/christensenjairus/ClusterCreator/blob/302f1da1897bc40f708a09683f53dba2eada5bbf/terraform/firewall.tf#L17
// const webserverSg = new proxmoxve.network.FirewallSecurityGroup(
//   'webserver-security-group',
//   {
//     comment: 'managed by pulumi',
//     rules: [
//       {
//         macro: ProxmoxFirewallMacro.HTTP,
//       },
//       {
//         macro: ProxmoxFirewallMacro.HTTPS,
//       },
//       {
//         macro: ProxmoxFirewallMacro.SSH,
//       },
//     ],
//   },
// );
