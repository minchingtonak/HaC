- opens the door for things like stack-specific provisioners/setup steps
- - figure out a better place to put the proxy network creation and setup stuff
  - should it be a provisioner?
  - should it be a provisioner on the proxy stack? that would be probably the cleanest solution but need to implement stack provisioners
    - consider having stack[.hbs].toml optionally in stack dir, it can contain provisioner definitions and any other metadata needed in the future
    - config file should be optional so only the proxy needs to have it for now basically, and any other stacks that require setup

- have multiple stacks for deploying to separate hosts

- do some preview-time checks to prevent broken deployments
  - container must deploy traefik (or whatever the proxy stack is)
  - possibly require some sort of monitoring/notif stacks on every host
  - would be cool to be able to configure these rules via file


- consider having a single komodo instance with generated config file
  - can expose list of all enabled stacks and use helpers to get domains for each app
    - need to modify domainFor helpers to optionally take a specific container as a second arg so the url generates correctly
- this also applies to dashboards in some ways. maybe would be cool to expose list of lxc hosts to do monitoring or something


- make pve host schema less confusing

- would be nice to have a linting step that checks the reference configs to make sure they have all members, even optional