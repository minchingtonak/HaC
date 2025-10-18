## Manually delete resources from the CLI

This also updates Pulumi Cloud.

1. find URN of the resource to delete

```bash
pulumi stack --show-urns
```

2. delete the resource
   - --target-dependents recursively deletes all children of the given resource

```bash
pulumi state delete --force --target-dependents urn:pulumi:homelab::HaC::HaC:proxmoxve:HomelabPveHost::homelab
```
