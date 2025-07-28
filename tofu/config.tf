locals {
  templates = {
    debian12 = {
      url      = "http://download.proxmox.com/images/system/debian-12-standard_12.7-1_amd64.tar.zst"
      filename = "debian-12-standard_12.7-1_amd64.tar.zst"
      os_type  = "debian"
      checksum = "39f6d06e082d6a418438483da4f76092ebd0370a91bad30b82ab6d0f442234d63fe27a15569895e34d6d1e5ca50319f62637f7fb96b98dbde4f6103cf05bff6d"
    }
    ubuntu24 = {
      url      = "http://download.proxmox.com/images/system/ubuntu-24.04-standard_24.04-1_amd64.tar.zst"
      filename = "ubuntu-24.04-standard_24.04-1_amd64.tar.zst"
      os_type  = "ubuntu"
    }
    alpine = {
      url      = "http://download.proxmox.com/images/system/alpine-3.19-default_20240207_amd64.tar.xz"
      filename = "alpine-3.19-default_20240207_amd64.tar.xz"
      os_type  = "alpine"
    }
  }

  default_storage_config = {
    template_datastore  = var.template_datastore
    container_datastore = var.container_datastore
  }

  default_security_config = {
    unprivileged = true
    protection   = false
  }

  default_startup_config = {
    start_on_boot = true
  }

  network_base = "192.168.0"
  network_config = {
    bridge  = var.network_bridge
    gateway = var.network_gateway
    # domain      = var.network_domain
    # dns_servers = var.network_dns
  }

  resource_profiles = {
    architecture = "amd64"

    small = {
      memory    = 512 # MB
      cpu_cores = 1
      disk_size = 8 # GB
    }
    medium = {
      memory    = 1024
      cpu_cores = 2
      disk_size = 16
    }
    large = {
      memory    = 2048
      cpu_cores = 4
      disk_size = 32
    }
    xlarge = {
      memory    = 4096
      cpu_cores = 6
      disk_size = 64
    }
  }

  ssh_keys = var.ssh_public_key != "" ? [trimspace(var.ssh_public_key)] : []

  # Helper function to generate IP address from container ID
  ip_from_ct_id = {
    for id in range(100, 256) : id => "${local.network_base}.${id}/24"
  }

  # # Container definitions from files
  # container_configs = {
  #   for filename in fileset("${path.root}/containers", "*.tf") :
  #   trimsuffix(filename, ".tf") => {
  #     source = "${path.root}/containers/${filename}"
  #   }
  # }
}
