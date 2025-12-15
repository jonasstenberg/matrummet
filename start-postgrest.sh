#!/bin/bash

# PostgREST Startup Agent
# Starts PostgREST API server using the postgrest.cfg configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/postgrest.cfg"

# Check if postgrest is installed
if ! command -v postgrest &> /dev/null; then
    echo "Error: postgrest is not installed"
    echo "Install with: brew install postgrest (macOS) or see https://postgrest.org/en/stable/install.html"
    exit 1
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Display configuration info
echo "Starting PostgREST API server..."
echo "  Config: $CONFIG_FILE"
echo "  Port: 4444"
echo "  Database: recept"
echo "  Schemas: public, auth"
echo ""

# Start PostgREST
exec postgrest "$CONFIG_FILE"
