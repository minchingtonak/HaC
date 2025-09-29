- auto update via bot PR with that one tool, scaffold? blueprint? something like that RENOVATE i think

- figure out a better standard for having defaults. need a standard way of defining default values for things that aren't explicit fields in the config by default, like privateKeyFile for ansible

- consider different syntax for secret vars

- opens the door for things like stack-specific provisioners/setup steps

- have multiple stacks for deploying to separate hosts

- refactor parser to be functional instead of calssbased

- see if a "from backup" option is possible, where it will check for a backup from a specific source and restore it instead of fresh creating
  - would be useful in cases where you need to redeploy all containers because some infra changed
