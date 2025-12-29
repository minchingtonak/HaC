#!/usr/bin/bash

##
# Local PBS Backup Script
# Backs up both app data and personal files to local Proxmox Backup Server
#
# If getting errors related to fingerprint mismatch, try running the script
# manually on the host and entering 'y' when prompted
#
# Create encryption keys:
#   proxmox-backup-client key create /root/appdata.key
#   proxmox-backup-client key create /root/personal-files.key
#
# To restore, you'll need the encryption key
# See: /docs/backup-client.html#restoring-data
#

set -Eeuo pipefail
PATH="$PATH:$HOME/.local/bin"

TAG="pbs-local$(date '+%y%m%d%H%M%S')"

# shellcheck source=/dev/null
source "$(dirname "$0")/pbs-backup-common.sh"

LOCAL_PBS_IP='192.168.8.189'

function backup() {
    setup_error_handling "$TAG"

    # note: this will need to be updated when the IP/cert of PBS is changed
    export PBS_FINGERPRINT='{{{SECRET_LOCAL_PBS_FINGERPRINT}}}'

    backup_app_data \
        "root@pam@$LOCAL_PBS_IP:appdata" \
        '{{{SECRET_APPDATA_ENCRYPTION_PASSWORD}}}' \
        '{{{SECRET_EDSAC_PBS_PASSWORD}}}' \
        './keys/appdata.key' \
        '{{{SECRET_APPDATA_HEALTHCHECK_PING_URL}}}' \
        'local PBS'

    backup_personal_files \
        "root@pam@$LOCAL_PBS_IP:personal-files" \
        '{{{SECRET_PERSONAL_FILES_AND_CLOUD_PBS_ENCRYPTION_PASSWORD}}}' \
        '{{{SECRET_EDSAC_PBS_PASSWORD}}}' \
        './keys/personal-files.key' \
        '{{{SECRET_PERSONAL_FILES_HEALTHCHECK_PING_URL}}}' \
        'local PBS'

    echo '🎉 all local PBS backups completed successfully!'
}

# use process substitution to display output in stdout and also send to syslog
backup 2>&1 | tee >(logger -t "$TAG")