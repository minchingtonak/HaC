# Proxmox Connection Variables
variable "proxmox_endpoint" {
  description = "The endpoint for the Proxmox Virtual Environment API"
  type        = string
  default     = "https://proxmox.local:8006"
}

# variable "proxmox_api_token" {
#   description = "The API token for Proxmox authentication"
#   type        = string
#   sensitive   = true
# }

variable "proxmox_username" {
  description = "Proxmox user username"
  type        = string
  default     = ""
  sensitive   = true
}

variable "proxmox_password" {
  description = "Proxmox user password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "proxmox_insecure" {
  description = "Whether to skip TLS verification"
  type        = bool
  default     = false
}

variable "proxmox_ssh_username" {
  description = "SSH username for Proxmox node access"
  type        = string
  default     = "root"
}

variable "proxmox_node_name" {
  description = "The name of the Proxmox node"
  type        = string
  default     = "proxmox"
}
