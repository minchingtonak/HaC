import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as pulumi from "@pulumi/pulumi";
import { PveHostConfig } from "../hosts/schema/pve-host-config";

export interface HomelabPveProviderArgs {
  pveConfig: PveHostConfig;
}

export class HomelabPveProvider extends proxmox.Provider {
  constructor(
    name: string,
    args: HomelabPveProviderArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    const config = args.pveConfig;

    const providerArgs: proxmox.ProviderArgs = {
      endpoint: config.endpoint,
      insecure: config.auth.insecure,
      username: config.auth.username,
      password: pulumi.secret(config.auth.password),
    };

    super(name, providerArgs, opts);
  }
}
