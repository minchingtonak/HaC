- integrate with ansible for container configuration
  https://www.pulumi.com/registry/packages/terraform-provider/
  `$ pulumi package add terraform-provider ansible/ansible`
  `import \* as ansible from '@pulumi/ansible';`

```hcl
# resource "ansible_group" "lxcs_group" {
#   name = "lxcs"
# }

# resource "ansible_host" "dashboard_lxc" {
#   depends_on = [proxmox_virtual_environment_container.dashboard_lxc]

#   name   = "dashboard-lxc"
#   groups = [ansible_group.lxcs_group.name]

#   variables = {
#     address = "192.168.122.206"
#   }
# }

# resource "ansible_playbook" "lxc_init_playbook" {
#   depends_on = [ansible_host.dashboard_lxc]

#   playbook   = "../ansible/lxc-init.yaml"
#   name       = ansible_host.dashboard_lxc.name
#   replayable = true
#   # ignore_playbook_failure = true

#   # all configuration variables must be prefixed with ansible_
#   # for plugins, they are prefixed with ansible_pluginname_
#   extra_vars = {
#     # https://docs.ansible.com/ansible/latest/reference_appendices/special_variables.html#connection-variables
#     ansible_user = "root"
#     ansible_host = ansible_host.dashboard_lxc.variables.address
#     # disable warning due to ansible automatically choosing the python version on the target
#     ansible_python_interpreter = "auto_silent"

#     # https://docs.ansible.com/ansible/2.9/plugins/connection/ssh.html#ssh-connection
#     ansible_ssh_host_key_checking = false
#     ansible_ssh_private_key_file  = "~/.ssh/lxc_ed25519"
#     ansible_ssh_retries = 10
#   }
# }
```

- finish up firewall configuration
