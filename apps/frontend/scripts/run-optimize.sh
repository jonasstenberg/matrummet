#!/bin/bash

# Wrapper script to run the image optimization script
# This ensures tsx is available and runs from the correct directory

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed. Please install Node.js and npm."
    exit 1
fi

# Run the TypeScript script
echo "Running image optimization script..."
npx tsx scripts/optimize-existing-images.ts "$@"
