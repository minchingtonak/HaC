#!/bin/bash
set -Eeuo pipefail


function restic() {
    docker run --rm \
        -v /mnt/repos/homelab:/data \
        -e RESTIC_PASSWORD="$RESTIC_PASSWORD" \
        restic/restic:latest "$@"
}

function rclone() {
    docker run --rm \
        -v /etc/komodo/stacks/cronicle/stacks/cronicle/rclone.conf:/config/rclone/rclone.conf:ro \
        -v /mnt/repos/homelab:/mnt/repos/homelab:ro \
        rclone/rclone:latest "$@"
}

RESTIC_PASSWORD='{{{SECRET_RESTIC_PASSWORD}}}'

function check() {
    echo 'Checking repo integrity...'
    restic -r /data check --read-data-subset '{{{RESTIC_CHECK_PERCENTAGE}}}%'
    echo 'Finished checking repo integrity'
}

function sync() {
    echo 'Syncing to b2:homelab-restic-repo...'
    rclone sync --track-renames --progress /mnt/repos/homelab "$@"
    echo 'Finished syncing to b2:homelab-restic-repo'
}

function healthcheck() {
    echo 'Pinging healthcheck...'
    curl -fsS -m 10 --retry 5 -o /dev/null '{{{SECRET_B2_SYNC_HEALTHCHECK_URL}}}'
    echo 'Finished pinging healthcheck'
}

check
sync b2:homelab-restic-repo
healthcheck