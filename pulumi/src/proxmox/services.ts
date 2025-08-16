import { HomelabContainer, HomelabContainerArgs } from './homelab-container';

const HOMELAB_CONTAINERS: HomelabContainerArgs[] = [
  {
    id: 215,
    hostname: 'mealie-pulumi',
    tags: ['recipe'],
    services: ['mealie'],
  },
];

export function deployContainers() {
  const containers: HomelabContainer[] = [];
  for (const ct of HOMELAB_CONTAINERS) {
    containers.push(
      new HomelabContainer(`${ct.hostname}-homelab-container`, ct),
    );
  }
  return containers;
}
