#!/bin/bash

set -Eeuxo pipefail

# Create a custom role with necessary permissions
pveum role add OpenTofu -privs "Datastore.AllocateSpace Datastore.Audit Pool.Allocate Sys.Audit Sys.Console Sys.Modify VM.Allocate VM.Audit VM.Clone VM.Config.CDROM VM.Config.Cloudinit VM.Config.CPU VM.Config.Disk VM.Config.HWType VM.Config.Memory VM.Config.Network VM.Config.Options VM.Monitor VM.PowerMgmt SDN.Use"

# Create API user
pveum user add opentofu@pve --password password

# Assign role to user
pveum aclmod / -user opentofu@pve -role OpenTofu

# Create API token
pveum user token add opentofu@pve tofu-access

# give the api token access to each datastore

# https://forum.proxmox.com/threads/administrator-user-cannot-create-vm-permission-check-failed-403.64012/
# Hi,
# as @chotaire already said, you need to add two more permissions for your user. One with path /vms and role PVEVMAdmin and one with path /nodes and role PVEVMAdmin should be sufficient.
