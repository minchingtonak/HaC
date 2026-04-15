#!/usr/bin/bash

##
# K3s NFS Cloud PBS Backup Script
# Backs up k3s NFS PVC directories to cloud Proxmox Backup Server
# using a ZFS snapshot for crash consistency.
#
# Usage: ./k3s-nfs-cloud-pbs-backup.sh <snapshot-name>
#
# Uses --backup-id k3s-nfs to distinguish this backup from the existing
# combined appdata/personal-files backup on the same cloud datastore.
#

set -Eeuo pipefail
PATH="$PATH:$HOME/.local/bin"

SNAPSHOT_NAME="${1:?snapshot name is required}"
TAG="pbs-k3s-nfs-cloud$(date '+%y%m%d%H%M%S')"

SNAPSHOT_PATH="/fast/k3s-nfs/.zfs/snapshot/${SNAPSHOT_NAME}"

# shellcheck source=/dev/null
source "$(dirname "$0")/pbs-backup-common.sh"

function backup() {
    setup_error_handling "$TAG"

    echo "📸 beginning k3s NFS backup to cloud PBS from snapshot: $SNAPSHOT_NAME"

    # Dynamically enumerate all PVC directories in the snapshot.
    backup_args=()

    for folder in "${SNAPSHOT_PATH}"/*/; do
        if [ -d "$folder" ]; then
            foldername=$(basename "$folder")
            echo "Adding PVC directory to backup: $foldername"
            backup_args+=("${foldername}.pxar:${folder}")
        fi
    done

    if [ ${#backup_args[@]} -gt 0 ]; then
        echo "Running k3s NFS backup for ${#backup_args[@]} PVC directories"

        export PBS_ENCRYPTION_PASSWORD='{{{SECRET_K3S_NFS_ENCRYPTION_PASSWORD}}}'
        export PBS_PASSWORD='{{{SECRET_CLOUD_PBS_API_TOKEN_SECRET}}}'

        set -x
        proxmox-backup-client backup \
            "${backup_args[@]}" \
            --repository '78cce27bc683469fb4cd@pbs!homelab-pve@sh19-112.prod.cloud-pbs.com:78cce27bc683469fb4cd' \
            --backup-id k3s-nfs \
            --change-detection-mode=metadata \
            --keyfile './keys/k3s-nfs.key'
        { set +x; } 2>/dev/null

        echo "✅ k3s NFS backup to cloud PBS completed successfully!"
    else
        echo "⚠️  No PVC directories found in snapshot at ${SNAPSHOT_PATH}"
    fi

    curl -fsS -m 10 --retry 5 -o /dev/null '{{{SECRET_K3S_NFS_CLOUD_HEALTHCHECK_URL}}}'

    echo '🎉 k3s NFS cloud PBS backup job done!'
}

# use process substitution to display output in stdout and also send to syslog
backup 2>&1 | tee >(logger -t "$TAG")
