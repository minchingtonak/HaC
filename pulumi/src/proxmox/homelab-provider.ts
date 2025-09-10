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
  baseContainerDomain?: string;
  lxcRootPassword?: string;
  lxcPublicSshKey?: string;
  lxcPrivateSshKey?: string;
  imageTemplateDatastoreId?: string;
  porkbunApiKey?: string;
  porkbunSecretKey?: string;
}

export class HomelabProvider extends proxmox.Provider {
  // FIXME expose string values by default for non secret fields
  public readonly pveNodeName: pulumi.Output<string>;
  public readonly localIpPrefix: pulumi.Output<string>;
  public readonly gatewayIp: pulumi.Output<string>;
  public readonly baseContainerDomain: pulumi.Output<string>;
  public readonly defaultRootPassword: pulumi.Output<string>;
  public readonly lxcPublicSshKey: pulumi.Output<string>;
  public readonly lxcPrivateSshKey: pulumi.Output<string>;
  public readonly imageTemplateDatastoreId: pulumi.Output<string>;
  public readonly porkbunApiKey: pulumi.Output<string>;
  public readonly porkbunSecretKey: pulumi.Output<string>;

  public readonly rawPveNodeName: string;
  public readonly rawLocalIpPrefix: string;
  public readonly rawGatewayIp: string;
  public readonly rawBaseContainerDomain: string;
  public readonly rawDefaultRootPassword: pulumi.Output<string>;
  public readonly rawLxcPublicSshKey: pulumi.Output<string>;
  public readonly rawLxcPrivateSshKey: pulumi.Output<string>;
  public readonly rawImageTemplateDatastoreId: string;
  public readonly rawPorkbunApiKey: pulumi.Output<string>;
  public readonly rawPorkbunSecretKey: pulumi.Output<string>;

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

    this.rawPveNodeName =
      args?.pveNodeName ?? homelabConfig.require('pveNodeName');
    this.rawLocalIpPrefix =
      args?.localIpPrefix ?? homelabConfig.require('localIpPrefix');
    this.rawGatewayIp = args?.gatewayIp ?? homelabConfig.require('gatewayIp');
    this.rawBaseContainerDomain = args?.baseContainerDomain ?? homelabConfig.require('baseContainerDomain');
    this.rawDefaultRootPassword =
      (args?.lxcRootPassword !== undefined &&
        pulumi.secret(args.lxcRootPassword)) ||
      homelabConfig.requireSecret('lxcRootPassword');
    this.rawLxcPublicSshKey =
      (args?.lxcPublicSshKey !== undefined &&
        pulumi.secret(args.lxcPublicSshKey)) ||
      homelabConfig.requireSecret('lxcPublicSshKey');
    this.rawLxcPrivateSshKey =
      (args?.lxcPrivateSshKey !== undefined &&
        pulumi.secret(args.lxcPrivateSshKey)) ||
      homelabConfig.requireSecret('lxcPrivateSshKey');
    this.rawImageTemplateDatastoreId =
      args?.imageTemplateDatastoreId ??
      homelabConfig.require('imageTemplateDatastoreId');
    this.rawPorkbunApiKey =
      (args?.porkbunApiKey !== undefined &&
        pulumi.secret(args.porkbunApiKey)) ||
      homelabConfig.requireSecret('porkbunApiKey');
    this.rawPorkbunSecretKey =
      (args?.porkbunSecretKey !== undefined &&
        pulumi.secret(args.porkbunSecretKey)) ||
      homelabConfig.requireSecret('porkbunSecretKey');

    this.pveNodeName = pulumi.output(this.rawPveNodeName);
    this.localIpPrefix = pulumi.output(this.rawLocalIpPrefix);
    this.gatewayIp = pulumi.output(this.rawGatewayIp);
    this.baseContainerDomain = pulumi.output(this.rawBaseContainerDomain);
    this.defaultRootPassword = pulumi.output(this.rawDefaultRootPassword);
    this.lxcPublicSshKey = pulumi.output(this.rawLxcPublicSshKey);
    this.lxcPrivateSshKey = pulumi.output(this.rawLxcPrivateSshKey);
    this.imageTemplateDatastoreId = pulumi.output(
      this.rawImageTemplateDatastoreId,
    );
    this.porkbunApiKey = pulumi.output(this.rawPorkbunApiKey);
    this.porkbunSecretKey = pulumi.output(this.rawPorkbunSecretKey);
  }
}
