#!/usr/bin/bash

##
# K3s NFS Local PBS Backup Script
# Backs up k3s NFS PVC directories to local Proxmox Backup Server
# using a ZFS snapshot for crash consistency.
#
# Usage: ./k3s-nfs-local-pbs-backup.sh <snapshot-name>
#
# The encryption key must be pre-generated (on any machine with proxmox-backup-client):
#   proxmox-backup-client key create ./k3s-nfs.key
# Store the key file contents as SECRET_K3S_NFS_PBS_CLIENT_KEY
# and the password as SECRET_K3S_NFS_ENCRYPTION_PASSWORD in Pulumi.
# The key is SCP'd to the PVE host at backup runtime — it does not need to live there.
#
# A 'k3s-nfs' datastore must exist on the local PBS (192.168.8.189).
#

set -Eeuo pipefail
PATH="$PATH:$HOME/.local/bin"

SNAPSHOT_NAME="${1:?snapshot name is required}"
TAG="pbs-k3s-nfs-local$(date '+%y%m%d%H%M%S')"

SNAPSHOT_PATH="/fast/k3s-nfs/.zfs/snapshot/${SNAPSHOT_NAME}"

LOCAL_PBS_IP='192.168.8.189'

# shellcheck source=/dev/null
source "$(dirname "$0")/pbs-backup-common.sh"

function backup() {
    setup_error_handling "$TAG"

    # note: this will need to be updated when the IP/cert of PBS is changed
    export PBS_FINGERPRINT='{{{SECRET_LOCAL_PBS_FINGERPRINT}}}'

    echo "📸 beginning k3s NFS backup to local PBS from snapshot: $SNAPSHOT_NAME"

    # Dynamically enumerate all PVC directories in the snapshot — new PVCs are
    # automatically included without any script changes.
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
        export PBS_PASSWORD='{{{SECRET_EDSAC_PBS_PASSWORD}}}'

        set -x
        proxmox-backup-client backup \
            "${backup_args[@]}" \
            --repository "root@pam@${LOCAL_PBS_IP}:k3s-nfs" \
            --backup-id k3s-nfs \
            --change-detection-mode=metadata \
            --keyfile './keys/k3s-nfs.key'
        { set +x; } 2>/dev/null

        echo "✅ k3s NFS backup to local PBS completed successfully!"
    else
        echo "⚠️  No PVC directories found in snapshot at ${SNAPSHOT_PATH}"
    fi

    curl -fsS -m 10 --retry 5 -o /dev/null '{{{SECRET_K3S_NFS_HEALTHCHECK_URL}}}'

    echo '🎉 k3s NFS local PBS backup job done!'
}

# use process substitution to display output in stdout and also send to syslog
backup 2>&1 | tee >(logger -t "$TAG")
