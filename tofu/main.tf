# resource "proxmox_virtual_environment_file" "debian12_docker_template" {
#   content_type = "vztmpl"
#   datastore_id = local.storage_config.template_datastore
#   node_name    = var.proxmox_node_name

#   source_file {
#     path      = local.templates.debian12.url
#     file_name = local.templates.debian12.filename
#   }
# }

resource "proxmox_virtual_environment_download_file" "debian_12_template" {
  content_type        = "vztmpl"
  datastore_id        = local.default_storage_config.template_datastore
  node_name           = var.proxmox_node_name
  url                 = local.templates.debian12.url
  checksum            = local.templates.debian12.checksum
  checksum_algorithm  = "sha512"
  overwrite_unmanaged = true
}

# TODO populate from secret store
# resource "random_password" "dashboard_lxc_password" {
#   length  = 16
#   special = true
#   upper   = true
#   lower   = true
#   numeric = true
# }

# TODO fix restart issue by refactoring constants into vars
# or by having deploy script pass all containers to -restart flag
# or with a custom module that passes through/reimplements all container config options and uses replace_triggered_by
resource "proxmox_virtual_environment_container" "dashboard_lxc" {
  node_name   = var.proxmox_node_name
  vm_id       = 205
  description = "managed by opentofu"
  tags        = ["opentofu", "docker", "dashboard"]

  unprivileged  = local.default_security_config.unprivileged
  start_on_boot = local.default_startup_config.start_on_boot
  protection    = local.default_security_config.protection

  operating_system {
    template_file_id = proxmox_virtual_environment_download_file.debian_12_template.id
    type             = local.templates.debian12.os_type
  }

  # mount_point {
  #   volume = "/void/podcasts"
  #   path   = "/mnt/podcasts"
  # }

  initialization {
    hostname = "dashboard"

    ip_config {
      ipv4 {
        address = local.ip_from_ct_id[205]
        gateway = local.network_config.gateway
      }
    }

    # dns {
    #   domain  = local.network_config.domain
    #   servers = local.network_config.dns_servers
    # }

    user_account {
      # keys     = local.ssh_keys
      # password = random_password.dashboard_lxc_password.result
      password = "testt"
    }
  }

  network_interface {
    name   = "eth0"
    bridge = local.network_config.bridge
  }

  disk {
    datastore_id = local.default_storage_config.container_datastore
    size         = local.resource_profiles.large.disk_size
  }

  memory {
    dedicated = local.resource_profiles.large.memory
    swap      = local.resource_profiles.large.memory / 2
  }

  cpu {
    cores        = local.resource_profiles.large.cpu_cores
    architecture = local.resource_profiles.architecture
  }

  features {
    nesting = true
    keyctl  = true
  }

  # startup {
  #   order      = 1
  #   up_delay   = 30
  #   down_delay = 60
  # }

  console {
    enabled   = true
    tty_count = 2
    type      = "tty"
  }


  depends_on = [proxmox_virtual_environment_download_file.debian_12_template]
}
