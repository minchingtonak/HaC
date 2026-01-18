#!/usr/bin/bash

# Function to send logs to Slack in chunks
# Parameters:
#   $1 - TAG to filter logs
function log_to_slack() {
    local TAG="$1"
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

# Function to send logs to Pushover in chunks
# Parameters:
#   $1 - TAG to filter logs
function log_to_pushover() {
    local TAG="$1"
    echo "gathering and sending logs with tag: $TAG"

    # remove useless metadata prefixes from logs
    LOGS="$(journalctl --since today | grep "$TAG" | sed "s/ homelab $TAG\[[0-9]*\]//")"

    length=1024
    CHUNKS=()

    for ((i=0; i<${#LOGS}; i+=length)); do
        CHUNKS+=("${LOGS:i:length}")
    done

    CHUNK_NUM=1
    TOTAL_CHUNKS=${#CHUNKS[@]}

    for CHUNK in "${CHUNKS[@]}"; do
        CHUNK_TITLE="[$TAG] backup job logs"

        # Add chunk header for multi-part messages
        if [ "$TOTAL_CHUNKS" -gt 1 ]; then
            CHUNK_TITLE="[$CHUNK_NUM/$TOTAL_CHUNKS]$CHUNK_TITLE (${#CHUNK}B)"
        fi

        PAYLOAD="{
            \"token\": \"{{{SECRET_PUSHOVER_BACKUP_JOB_TOKEN}}}\",
            \"user\": \"{{{pushover:SECRET_USER_TOKEN}}}\",
            \"title\": $(printf "%s" "$CHUNK_TITLE" | jq -Rsa .),
            \"message\": $(printf "%s" "$CHUNK" | jq -Rsa .)
        }"

        echo "Sending chunk $CHUNK_NUM/$TOTAL_CHUNKS"
        curl -s -X POST -H 'Content-type: application/json' \
            --data "$PAYLOAD" \
            "https://api.pushover.net/1/messages.json"

        if [ "$CHUNK_NUM" -lt "$TOTAL_CHUNKS" ]; then
            sleep 1
        fi

        CHUNK_NUM=$((CHUNK_NUM + 1))
    done
}

# Error handler that logs to Slack and exits
# Parameters:
#   $1 - Line number where error occurred
#   $2 - TAG to filter logs
function handle_error() {
    { set +x; } 2>/dev/null

    local line_num="$1"
    local tag="$2"

    MESSAGE="⛔ error in $0 at line $line_num (command '$BASH_COMMAND')"
    echo "$MESSAGE"

    log_to_pushover "$tag"

    log_to_slack "$tag"

    exit 1
}

# Setup error handling trap
# Parameters:
#   $1 - TAG to pass to error handler for log filtering
function setup_error_handling() {
    local tag="$1"
    trap 'handle_error $LINENO "'"$tag"'"' ERR
}

# Backup app data to PBS
# Parameters:
#   $1 - PBS repository URL
#   $2 - Encryption password
#   $3 - PBS password
#   $4 - Keyfile path
#   $5 - Healthcheck ping URL
#   $6 - Backup location name (for logging)
function backup_app_data() {
    local repository="$1"
    local encryption_password="$2"
    local pbs_password="$3"
    local keyfile="$4"
    local healthcheck_url="$5"
    local location_name="$6"

    echo "📸 beginning app data backup to $location_name"

    # Collect all backup arguments for app data
    backup_args=()

    for folder in {{{@pve.lxc.app_data_dir}}}/*/; do
        if [ -d "$folder" ]; then
            foldername=$(basename "$folder")

            echo "Adding folder to backup: $foldername"
            backup_args+=("${foldername}-lxc-appdata.pxar:${folder}")
        fi
    done

    # Run app data backup if folders exist
    if [ ${#backup_args[@]} -gt 0 ]; then
        echo "Running app data backup for ${#backup_args[@]} folders"

        # shellcheck disable=SC2016
        export PBS_ENCRYPTION_PASSWORD="$encryption_password"
        export PBS_PASSWORD="$pbs_password"

        set -x
        proxmox-backup-client backup \
            "${backup_args[@]}" \
            --repository "$repository" \
            --change-detection-mode=metadata \
            --keyfile "$keyfile"
        { set +x; } 2>/dev/null

        echo "✅ app data backup to $location_name completed successfully!"
    else
        echo "⚠️  No app data folders found to backup"
    fi

    curl -fsS -m 10 --retry 5 -o /dev/null "$healthcheck_url"
}

# Backup personal files to PBS
# Parameters:
#   $1 - PBS repository URL
#   $2 - Encryption password
#   $3 - PBS password
#   $4 - Keyfile path
#   $5 - Healthcheck ping URL
#   $6 - Backup location name (for logging)
function backup_personal_files() {
    local repository="$1"
    local encryption_password="$2"
    local pbs_password="$3"
    local keyfile="$4"
    local healthcheck_url="$5"
    local location_name="$6"

    echo "📸 beginning personal files backup to $location_name"

    # shellcheck disable=SC2016
    export PBS_ENCRYPTION_PASSWORD="$encryption_password"
    export PBS_PASSWORD="$pbs_password"

    set -x
    proxmox-backup-client backup \
        documents.pxar:/void/documents \
        drive.pxar:/void/drive \
        photos.pxar:/void/photos \
        --repository "$repository" \
        --change-detection-mode=metadata \
        --keyfile "$keyfile"
    { set +x; } 2>/dev/null

    echo "✅ personal files backup to $location_name completed successfully!"

    curl -fsS -m 10 --retry 5 -o /dev/null "$healthcheck_url"
}

# Backup music files to PBS
# Parameters:
#   $1 - PBS repository URL
#   $2 - Encryption password
#   $3 - PBS password
#   $4 - Keyfile path
#   $5 - Healthcheck ping URL
#   $6 - Backup location name (for logging)
function backup_music() {
    local repository="$1"
    local encryption_password="$2"
    local pbs_password="$3"
    local keyfile="$4"
    local healthcheck_url="$5"
    local location_name="$6"

    echo "📸 beginning music backup to $location_name"

    # shellcheck disable=SC2016
    export PBS_ENCRYPTION_PASSWORD="$encryption_password"
    export PBS_PASSWORD="$pbs_password"

    set -x
    proxmox-backup-client backup \
        music.pxar:/void/media/music \
        --repository "$repository" \
        --change-detection-mode=metadata \
        --keyfile "$keyfile"
    { set +x; } 2>/dev/null

    echo "✅ personal files backup to $location_name completed successfully!"

    curl -fsS -m 10 --retry 5 -o /dev/null "$healthcheck_url"
}

# Backup both app data and personal files to PBS in a single command
# This is required for PBS datastores that need all data in one backup snapshot
# Parameters:
#   $1 - PBS repository URL
#   $2 - Encryption password
#   $3 - PBS password
#   $4 - Keyfile path
#   $5 - App data healthcheck ping URL
#   $6 - Personal files healthcheck ping URL
#   $7 - Backup location name (for logging)
function backup_combined() {
    local repository="$1"
    local encryption_password="$2"
    local pbs_password="$3"
    local keyfile="$4"
    local appdata_healthcheck_url="$5"
    local personal_healthcheck_url="$6"
    local location_name="$7"

    echo "📸 beginning combined backup to $location_name"

    # Collect all backup arguments
    backup_args=()

    # Add app data folders
    for folder in {{{@pve.lxc.app_data_dir}}}/*/; do
        if [ -d "$folder" ]; then
            foldername=$(basename "$folder")
            echo "Adding app data folder to backup: $foldername"
            backup_args+=("${foldername}-lxc-appdata.pxar:${folder}")
        fi
    done

    echo "Adding personal files to backup"
    backup_args+=(
        "documents.pxar:/void/documents"
        "drive.pxar:/void/drive"
        "photos.pxar:/void/photos"
    )

    if [ ${#backup_args[@]} -gt 0 ]; then
        echo "Running combined backup with ${#backup_args[@]} items"

        # shellcheck disable=SC2016
        export PBS_ENCRYPTION_PASSWORD="$encryption_password"
        export PBS_PASSWORD="$pbs_password"

        set -x
        proxmox-backup-client backup \
            "${backup_args[@]}" \
            --repository "$repository" \
            --change-detection-mode=metadata \
            --keyfile "$keyfile"
        { set +x; } 2>/dev/null

        echo "✅ combined backup to $location_name completed successfully!"
    else
        echo "⚠️  No data found to backup"
    fi

    # Ping both healthcheck URLs
    curl -fsS -m 10 --retry 5 -o /dev/null "$appdata_healthcheck_url"
    curl -fsS -m 10 --retry 5 -o /dev/null "$personal_healthcheck_url"
}