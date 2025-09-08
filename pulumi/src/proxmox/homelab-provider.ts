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
  porkbunApiKey?: string;
  porkbunSecretKey?: string;
}

export class HomelabProvider extends proxmox.Provider {
  public readonly pveNodeName: pulumi.Output<string>;
  public readonly localIpPrefix: pulumi.Output<string>;
  public readonly gatewayIp: pulumi.Output<string>;
  public readonly defaultRootPassword: pulumi.Output<string>;
  public readonly lxcPublicSshKey: pulumi.Output<string>;
  public readonly lxcPrivateSshKey: pulumi.Output<string>;
  public readonly imageTemplateDatastoreId: pulumi.Output<string>;
  public readonly porkbunApiKey: pulumi.Output<string>;
  public readonly porkbunSecretKey: pulumi.Output<string>;

  // Raw config values
  private readonly rawPveNodeName: string;
  private readonly rawLocalIpPrefix: string;
  private readonly rawGatewayIp: string;
  private readonly rawDefaultRootPassword: string | pulumi.Output<string>;
  private readonly rawLxcPublicSshKey: string | pulumi.Output<string>;
  private readonly rawLxcPrivateSshKey: string | pulumi.Output<string>;
  private readonly rawImageTemplateDatastoreId: string;
  private readonly rawPorkbunApiKey: string | pulumi.Output<string>;
  private readonly rawPorkbunSecretKey: string | pulumi.Output<string>;

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

    // Store raw config values
    this.rawPveNodeName = args?.pveNodeName ?? homelabConfig.require('pveNodeName');
    this.rawLocalIpPrefix = args?.localIpPrefix ?? homelabConfig.require('localIpPrefix');
    this.rawGatewayIp = args?.gatewayIp ?? homelabConfig.require('gatewayIp');
    this.rawDefaultRootPassword = args?.lxcRootPassword ?? homelabConfig.requireSecret('lxcRootPassword');
    this.rawLxcPublicSshKey = args?.lxcPublicSshKey ?? homelabConfig.requireSecret('lxcPublicSshKey');
    this.rawLxcPrivateSshKey = args?.lxcPrivateSshKey ?? homelabConfig.requireSecret('lxcPrivateSshKey');
    this.rawImageTemplateDatastoreId = args?.imageTemplateDatastoreId ??
      homelabConfig.require('imageTemplateDatastoreId');
    this.rawPorkbunApiKey = args?.porkbunApiKey ?? homelabConfig.requireSecret('porkbunApiKey');
    this.rawPorkbunSecretKey = args?.porkbunSecretKey ?? homelabConfig.requireSecret('porkbunSecretKey');

    // Create pulumi outputs from raw values
    this.pveNodeName = pulumi.output(this.rawPveNodeName);
    this.localIpPrefix = pulumi.output(this.rawLocalIpPrefix);
    this.gatewayIp = pulumi.output(this.rawGatewayIp);
    this.defaultRootPassword = pulumi.output(this.rawDefaultRootPassword);
    this.lxcPublicSshKey = pulumi.output(this.rawLxcPublicSshKey);
    this.lxcPrivateSshKey = pulumi.output(this.rawLxcPrivateSshKey);
    this.imageTemplateDatastoreId = pulumi.output(this.rawImageTemplateDatastoreId);
    this.porkbunApiKey = pulumi.output(this.rawPorkbunApiKey);
    this.porkbunSecretKey = pulumi.output(this.rawPorkbunSecretKey);
  }
}
