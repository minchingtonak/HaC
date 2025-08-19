#!/bin/bash

echo "Test script executed successfully!"
echo "Number of arguments: $#"

if [ $# -gt 0 ]; then
    echo "Arguments received:"
    for arg in "$@"; do
        echo "- $arg"
    done
else
    echo "No arguments received."
fi

exit 0
