#!/usr/bin/env bash
# post-deploy.sh — Sync rendered Pulumi template to live Hermes config
#
# Pulumi deploys compose and config templates to /etc/pulumi/stacks/hermes,
# but Hermes itself rewrites config.yaml at runtime inside the bind-mounted
# volume /docker/hermes/home. This script copies the fresh template over the
# live file and restarts the agent services so the new config is picked up.
#
# Usage:
#   ./hosts/stacks/hermes/post-deploy.sh
#
# Environment:
#   LXC_HOST    — target LXC IP or hostname (default: 192.168.20.208)
#   SSH_KEY     — path to SSH private key (default: ~/.ssh/lxc_ed25519)
#   SSH_USER    — remote user (default: root)
#
# Example with overrides:
#   LXC_HOST=192.168.20.209 SSH_KEY=~/.ssh/other_key ./post-deploy.sh

set -euo pipefail

LXC_HOST="${LXC_HOST:-192.168.20.208}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lxc_ed25519}"
SSH_USER="${SSH_USER:-root}"

REMOTE_TEMPLATE="/etc/pulumi/stacks/hermes/config.yaml"
REMOTE_LIVE="/docker/hermes/home/config.yaml"
CONTAINERS=(hermes-agent hermes-dashboard)

SSH_CMD=(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${SSH_USER}@${LXC_HOST}")

echo "[post-deploy] Syncing ${REMOTE_TEMPLATE} → ${REMOTE_LIVE} on ${LXC_HOST}"
echo "[post-deploy] containers to restart: ${CONTAINERS[*]}"

# Copy rendered template to live path and fix ownership (hermes runs as 10000)
"${SSH_CMD[@]}" "
    cp '${REMOTE_TEMPLATE}' '${REMOTE_LIVE}'
    chown 10000:10000 '${REMOTE_LIVE}'
    echo '[post-deploy] config synced, owner set to 10000:10000'
"

# Restart services so the new config is read
"${SSH_CMD[@]}" "docker restart ${CONTAINERS[*]}"

# Wait briefly and check health
echo '[post-deploy] waiting 5s for containers to settle...'
sleep 5

"${SSH_CMD[@]}" "docker ps --format 'table {{.Names}}\t{{.Status}}' --filter 'name=hermes' || true"

echo '[post-deploy] done'
