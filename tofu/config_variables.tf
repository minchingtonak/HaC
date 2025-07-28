variable "network_bridge" {
  description = "The network bridge to use for containers"
  type        = string
  default     = "vmbr0"
}

variable "network_gateway" {
  description = "The network gateway IP address"
  type        = string
}

variable "template_datastore" {
  description = "Datastore for container templates"
  type        = string
  default     = "local"
}

variable "container_datastore" {
  description = "Datastore for container storage"
  type        = string
  default     = "local-lvm"
}

variable "ssh_public_key" {
  description = "SSH public key for container access (optional)"
  type        = string
  default     = ""
  sensitive   = true
}
