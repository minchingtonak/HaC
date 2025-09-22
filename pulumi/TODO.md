- auto update via bot PR with that one tool, scaffold? blueprint? something like that RENOVATE i think

- figure out a better standard for having defaults. need a standard way of defining default values for things that aren't explicit fields in the config by default, like privateKeyFile for ansible

- firewall config for proxomx node as well
  - consider making nodes more of a first class entity
    - custom resource for them that manages firewall, spawning containers
    - will make many currently static global vars into per-node
  - folder of toml configs for pve nodes, works the same way as host configs

- remove name field for provisioners

- consider different syntax for secret vars

- opens the door for things like stack-specific provisioners/setup steps

- have multiple stacks for deploying to separate hosts

- idea: declarative task runner with web ui
  - notification support via apprise sidecar, probably
  - tasks defined in yaml or toml, have name, cron schedule, and script that they run (can look at semaphore, cronicle for ref)
    - can also run ansible playbooks

- wipe thinkpad and install proxmox, can use as git runner (and gitea instance in the future)
  - set up github action to invoke the self hosted runner
  - runner will run pulumi up command and wait for my confirmation somehow

- need templating support for pve config variable values? e.g. pvenodename = https://{{{NODE_NAME}}}.{{ROOT_DOMAIN}}



TODO
- refactor all other hosts/stacks for new domain system
- test actually deploying a simple stack, not servarr

