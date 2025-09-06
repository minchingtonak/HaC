- refactor constants

- toml schema for file provisioner on hosts? for now maybe not necessary since you can have arbitrary files in a stack directory

- finish up firewall configuration

- look into command execution on PVE host as well as containers
  - https://github.com/ItsMeBrianD/homelab-automation/blob/680fa1c405a8c0dedb9c0e171befcf608715dce4/pulumi/src/proxmox/Provider.ts#L26

- inspiration from github
  - https://github.com/ItsMeBrianD/homelab-automation/blob/680fa1c405a8c0dedb9c0e171befcf608715dce4/pulumi/src/proxmox/cloud/BuildVmOptions.ts#L24
  - https://github.com/ItsMeBrianD/homelab-automation/blob/680fa1c405a8c0dedb9c0e171befcf608715dce4/pulumi/src/proxmox/cloud/CloudImageTemplate.ts
  - refactor into factory functions? look at link for provider example https://github.com/IsaacOrzDev/personal-website-pulumi/blob/559111450e88380234573de73fe67a5748f4c4d7/src/certificate.ts
  - class to encapsulate a service deployment?
    - https://github.com/graphql-hive/console/blob/main/deployment/utils/service-deployment.ts#L32
    - https://github.com/graphql-hive/console/blob/8ff04c56f7f0471f8249d1c21a5b27d54fc0d37c/deployment/services/graphql.ts
