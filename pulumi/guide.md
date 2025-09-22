
## issues guide

### cannot connect to service via proxy url despite config looking correct

this can happen if the container is on another nonexternal network. for some reason,
traefik fails to find the correct docker network ip for the container and will fail to proxy,
usually with a gateway timeout error.

I checked the ip for gitea seen in `docker network inspect traefik` and it was different than
the ip shown in the traefik dashboard

```yaml
networks:
  # WARNING: adding the container to another network seems to confuse traefik's
  # address detection and cause proxying to fail
  gitea:
    external: false
```
