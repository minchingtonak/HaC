#!/usr/bin/bash

##
# Cloud PBS Backup Script
# Backs up both app data and personal files to cloud Proxmox Backup Server
#
# If getting errors related to fingerprint mismatch, try running the script
# manually on the host and entering 'y' when prompted
#
# Create encryption key:
#   proxmox-backup-client key create /root/cloud-pbs.key
#
# To restore, you'll need the encryption key
# See: /docs/backup-client.html#restoring-data
#

set -Eeuo pipefail
PATH="$PATH:$HOME/.local/bin"

TAG="pbs-cloud$(date '+%y%m%d%H%M%S')"

# shellcheck source=/dev/null
source "$(dirname "$0")/pbs-backup-common.sh"

function backup() {
    setup_error_handling "$TAG"

    # Cloud PBS uses a single datastore, so all data must be backed up in one command
    backup_combined \
        '78cce27bc683469fb4cd@pbs!homelab-pve@sh19-112.prod.cloud-pbs.com:78cce27bc683469fb4cd' \
        '{{{SECRET_PERSONAL_FILES_AND_CLOUD_PBS_ENCRYPTION_PASSWORD}}}' \
        '{{{SECRET_CLOUD_PBS_API_TOKEN_SECRET}}}' \
        './keys/cloud-pbs.key' \
        'cloud PBS'

    curl -fsS -m 10 --retry 5 -o /dev/null '{{{SECRET_CLOUD_PBS_BACKUP_HEALTHCHECK_URL}}}'

    echo '🎉 all cloud PBS backups completed successfully!'
}

# use process substitution to display output in stdout and also send to syslog
backup 2>&1 | tee >(logger -t "$TAG")