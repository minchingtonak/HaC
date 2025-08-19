#!/bin/bash

## Cronicle plugin to run a script at an arbitrary path
# https://github.com/jhuckaby/Cronicle/blob/master/docs/Plugins.md

function handle_error() {
    MESSAGE="Error in $0 at line $1 (command '$BASH_COMMAND')"
    echo "{ \"complete\": 1, \"code\": 1, \"description\": \"$MESSAGE\" }"
}

trap 'handle_error $LINENO' ERR

echo "Running script at path: $SCRIPT"

. $SCRIPT

echo '{ "complete": 1, "code": 0 }'
