import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import * as pulumi from '@pulumi/pulumi';

export interface HomelabProviderArgs {
  endpoint?: string;
  insecure?: boolean;
  username?: string;
  password?: string;
  pveNodeName?: string;
  localIpPrefix?: string;
  gatewayIp?: string;
  lxcRootPassword?: string;
  lxcPublicSshKey?: string;
  lxcPrivateSshKey?: string;
  imageTemplateDatastoreId?: string;
}

export class HomelabProvider extends proxmox.Provider {
  public readonly pveNodeName: pulumi.Output<string>;
  public readonly localIpPrefix: pulumi.Output<string>;
  public readonly gatewayIp: pulumi.Output<string>;
  public readonly defaultRootPassword: pulumi.Output<string>;
  public readonly lxcPublicSshKey: pulumi.Output<string>;
  public readonly lxcPrivateSshKey: pulumi.Output<string>;
  public readonly imageTemplateDatastoreId: pulumi.Output<string>;

  constructor(
    name: string,
    args?: HomelabProviderArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    const homelabConfig = new pulumi.Config(name);

    const providerArgs = {
      endpoint: args?.endpoint ?? homelabConfig.require('pveEndpoint'),
      insecure: args?.insecure ?? homelabConfig.requireBoolean('pveInsecure'),
      username: args?.username ?? homelabConfig.requireSecret('pveUsername'),
      password: args?.password ?? homelabConfig.requireSecret('pvePassword'),
    };

    super(name, providerArgs, opts);

    this.pveNodeName = pulumi.output(
      args?.pveNodeName ?? homelabConfig.require('pveNodeName'),
    );
    this.localIpPrefix = pulumi.output(
      args?.localIpPrefix ?? homelabConfig.require('localIpPrefix'),
    );
    this.gatewayIp = pulumi.output(
      args?.gatewayIp ?? homelabConfig.require('gatewayIp'),
    );
    this.defaultRootPassword = pulumi.output(
      args?.lxcRootPassword ?? homelabConfig.requireSecret('lxcRootPassword'),
    );
    this.lxcPublicSshKey = pulumi.output(
      args?.lxcPublicSshKey ?? homelabConfig.requireSecret('lxcPublicSshKey'),
    );
    this.lxcPrivateSshKey = pulumi.output(
      args?.lxcPrivateSshKey ?? homelabConfig.requireSecret('lxcPrivateSshKey'),
    );
    this.imageTemplateDatastoreId = pulumi.output(
      args?.imageTemplateDatastoreId ??
        homelabConfig.require('imageTemplateDatastoreId'),
    );
  }
}
