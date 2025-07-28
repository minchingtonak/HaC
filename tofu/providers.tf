terraform {
  required_version = ">= 1.0"

  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> 0.78.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7.0"
    }
  }
}

provider "proxmox" {
  endpoint = var.proxmox_endpoint
  # api_token = var.proxmox_api_token

  # only the root user can create bind mounts in LXC containers :/
  # https://forum.proxmox.com/threads/is-it-possible-to-deploy-lxc-container-through-the-api-with-bind-mounts.124543/post-542617
  username = var.proxmox_username
  password = var.proxmox_password

  insecure = var.proxmox_insecure

  ssh {
    agent    = true
    username = var.proxmox_ssh_username
  }
}
