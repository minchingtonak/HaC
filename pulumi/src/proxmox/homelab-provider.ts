import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import * as pulumi from '@pulumi/pulumi';
import { PveHostConfigToml } from '../hosts/pve-host-config-schema';

export interface HomelabProviderArgs {
  pveHostConfig: PveHostConfigToml | pulumi.Output<PveHostConfigToml>;
}

export class HomelabProvider extends proxmox.Provider {
  public readonly pveNodeName: pulumi.Output<string>;
  public readonly localIpPrefix: pulumi.Output<string>;
  public readonly gatewayIp: pulumi.Output<string>;
  public readonly rootContainerDomain: pulumi.Output<string>;
  public readonly defaultRootPassword: pulumi.Output<string>;
  public readonly lxcPublicSshKey: pulumi.Output<string>;
  public readonly lxcPrivateSshKey: pulumi.Output<string>;
  public readonly imageTemplateDatastoreId: pulumi.Output<string>;
  public readonly porkbunApiKey: pulumi.Output<string>;
  public readonly porkbunSecretKey: pulumi.Output<string>;

  constructor(
    name: string,
    args: HomelabProviderArgs,
    opts?: pulumi.ResourceOptions,
  ) {
    const config = pulumi.output(args.pveHostConfig);

    const providerArgs = {
      endpoint: config.apply(c => c.pve.endpoint),
      insecure: config.apply(c => c.pve.auth.insecure),
      username: config.apply(c => c.pve.auth.username),
      password: pulumi.secret(config.apply(c => c.pve.auth.password)),
    };

    super(name, providerArgs, opts);

    this.pveNodeName = config.apply(c => c.pve.node);
    this.localIpPrefix = config.apply(c => c.lxc.network.subnet);
    this.gatewayIp = config.apply(c => c.lxc.network.gateway || `${c.lxc.network.subnet}.1`);
    this.rootContainerDomain = config.apply(c => c.lxc.network.domain);
    this.defaultRootPassword = pulumi.secret(config.apply(c => c.lxc.auth.password));
    this.lxcPublicSshKey = pulumi.secret(config.apply(c => c.lxc.ssh.publicKey));
    this.lxcPrivateSshKey = pulumi.secret(config.apply(c => c.lxc.ssh.privateKey));
    this.imageTemplateDatastoreId = config.apply(c => c.storage.templates);
    this.porkbunApiKey = pulumi.secret(config.apply(c => c.lxc.dns?.porkbun?.apiKey || ''));
    this.porkbunSecretKey = pulumi.secret(config.apply(c => c.lxc.dns?.porkbun?.secretKey || ''));
  }

  public toObject(): pulumi.Output<Record<string, string>> {
    return pulumi.all({
      pveNodeName: this.pveNodeName,
      localIpPrefix: this.localIpPrefix,
      gatewayIp: this.gatewayIp,
      rootContainerDomain: this.rootContainerDomain,
      defaultRootPassword: this.defaultRootPassword,
      lxcPublicSshKey: this.lxcPublicSshKey,
      lxcPrivateSshKey: this.lxcPrivateSshKey,
      imageTemplateDatastoreId: this.imageTemplateDatastoreId,
      porkbunApiKey: this.porkbunApiKey,
      porkbunSecretKey: this.porkbunSecretKey,
    });
  }
}
