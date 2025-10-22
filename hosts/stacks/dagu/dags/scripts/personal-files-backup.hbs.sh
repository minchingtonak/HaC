#!/usr/bin/bash

##
# if getting errors related to fingerprint mismatch, try running the script
# manually on the host and entering 'y' when prompted
#
# create an encryption key: proxmox-backup-client key create /root/personal-files.key
#
# to restore, you'll need the encryption key
# /docs/backup-client.html#restoring-data
#
# see interactive restores specifically: /docs/backup-client.html#restoring-data
#

set -Eeuo pipefail
PATH="$PATH:$HOME/.local/bin"

TAG="pbs-pf$(date '+%y%m%d%H%M%S')"

function backup() {
    # shellcheck disable=SC2329
    function log_to_slack() {
        echo "gathering and sending logs with tag: $TAG"

        # remove useless metadata prefixes from logs
        LOGS="$(journalctl --since today | grep "$TAG" | sed "s/ homelab $TAG\[[0-9]*\]//")"

        length=15000
        CHUNKS=()

        for ((i=0; i<${#LOGS}; i+=length)); do
            CHUNKS+=("${LOGS:i:length}")
        done

        CHUNK_NUM=1
        TOTAL_CHUNKS=${#CHUNKS[@]}

        for CHUNK in "${CHUNKS[@]}"; do
            # Add chunk header for multi-part messages
            if [ "$TOTAL_CHUNKS" -gt 1 ]; then
                CHUNK_CONTENT="[Part $CHUNK_NUM/$TOTAL_CHUNKS]"$'\n'"$CHUNK"
            else
                CHUNK_CONTENT="$CHUNK"
            fi

            TEXT="$(printf "%s" "$CHUNK_CONTENT" | jq -Rsa .)"

            echo "Sending chunk $CHUNK_NUM/$TOTAL_CHUNKS"
            curl -s -X POST -H 'Content-type: application/json' \
                --data "{\"text\":$TEXT}" \
                "{{{SECRET_BACKUP_SCRIPT_SLACK_WEBHOOK}}}"

            if [ "$CHUNK_NUM" -lt "$TOTAL_CHUNKS" ]; then
                sleep 1
            fi

            CHUNK_NUM=$((CHUNK_NUM + 1))
        done
    }

    # shellcheck disable=SC2329
    function handle_error() {
        { set +x; } 2>/dev/null

        MESSAGE="⛔ error in $0 at line $1 (command '$BASH_COMMAND')"
        echo "$MESSAGE"

        log_to_slack

        exit 1
    }
    trap 'handle_error $LINENO' ERR

    echo '📸 beginning personal files backup'

    # shellcheck disable=SC2016
    export PBS_ENCRYPTION_PASSWORD='{{{SECRET_PERSONAL_FILES_AND_CLOUD_PBS_ENCRYPTION_PASSWORD}}}'

    # root user password for local pbs
    export PBS_PASSWORD='{{{SECRET_EDSAC_PBS_PASSWORD}}}'

    set -x
    proxmox-backup-client backup \
        documents.pxar:/void/documents \
        drive.pxar:/void/drive \
        photos.pxar:/void/photos \
        --repository 'root@pam@192.168.0.189:personal-files' \
        --change-detection-mode=metadata \
        --keyfile ./keys/personal-files.key # --dry-run
    { set +x; } 2>/dev/null

    # API token secret
    export PBS_PASSWORD='{{{SECRET_CLOUD_PBS_API_TOKEN_SECRET}}}'

    # set -x
    # proxmox-backup-client backup \
    #     documents.pxar:/void/documents \
    #     drive.pxar:/void/drive \
    #     photos.pxar:/void/photos \
    #     --repository '78cce27bc683469fb4cd@pbs!homelab-pve@sh19-112.prod.cloud-pbs.com:78cce27bc683469fb4cd' \
    #     --change-detection-mode=metadata \
    #     --keyfile ./keys/cloud-pbs.key # --dry-run
    # { set +x; } 2>/dev/null

    curl -fsS -m 10 --retry 5 -o /dev/null "{{{SECRET_PERSONAL_FILES_HEALTHCHECK_PING_URL}}}"

    echo '✅ personal files backup completed successfully!'
}

# use process substitution to display output in stdout and also send to syslog
backup 2>&1 | tee >(logger -t "$TAG")
