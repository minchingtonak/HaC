packer {
  required_plugins {
    lxc = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/lxc"
    }
  }
}

# Variables for customization
variable "container_name" {
  type        = string
  default     = "debian12-docker"
  description = "Name for the LXC container"
}

variable "output_dir" {
  type        = string
  default     = "./output"
  description = "Directory to store the container template"
}

# https://developer.hashicorp.com/packer/integrations/hashicorp/lxc/latest/components/builder/lxc
source "lxc" "debian12-docker" {
  config_file   = "./files/default.conf"
  template_name = "download"
  template_parameters = [
    "--dist=debian",
    "--release=bookworm",
    "--arch=amd64"
  ]

  create_options = [
    "--logfile=./create.log",
    "--logpriority=INFO"
  ]

  start_options = [
    "--foreground",
    "--logfile=./start.log",
    "--logpriority=INFO"
  ]

  container_name = var.container_name
  output_directory = var.output_dir
}

build {
  sources = ["source.lxc.debian12-docker"]

  provisioner "shell" {
    inline = [
      "apt-get update",
      "apt-get upgrade -y"
    ]
  }

  provisioner "file" {
    source      = "./scripts/provision.sh"
    destination = "/tmp/provision.sh"
  }
}