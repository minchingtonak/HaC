import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as pulumi from "@pulumi/pulumi";
import { PveHostConfigToml } from "../hosts/pve-host-config-schema";

export interface HomelabPveProviderArgs {
  pveHostConfig: PveHostConfigToml | pulumi.Output<PveHostConfigToml>;
}

export class HomelabPveProvider extends proxmox.Provider {
  constructor(
    name: string,
    args: HomelabPveProviderArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    const config = pulumi.output(args.pveHostConfig);

    const providerArgs: proxmox.ProviderArgs = {
      endpoint: config.apply((c) => c.endpoint),
      insecure: config.apply((c) => c.auth.insecure),
      username: config.apply((c) => c.auth.username),
      password: pulumi.secret(config.apply((c) => c.auth.password)),
    };

    super(name, providerArgs, opts);
  }
}
