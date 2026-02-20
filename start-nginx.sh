#!/bin/bash

# Local nginx for serving recipe images
# Mirrors production where nginx serves /uploads/ directly from disk

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPLOADS_DIR="$SCRIPT_DIR/apps/frontend/public/uploads"
TEMPLATE="$SCRIPT_DIR/nginx/dev.conf"
RUNTIME_CONF="/tmp/matrummet-nginx-dev.conf"

if ! command -v nginx &> /dev/null; then
    echo "Error: nginx is not installed"
    echo "Install with: brew install nginx"
    exit 1
fi

mkdir -p "$UPLOADS_DIR"

# Generate runtime config with absolute uploads path
sed "s|__UPLOADS_DIR__|$UPLOADS_DIR|g" "$TEMPLATE" > "$RUNTIME_CONF"

echo "Starting nginx image server..."
echo "  Uploads: $UPLOADS_DIR"
echo "  URL: http://localhost:4446/uploads/{imageId}/{size}.webp"
echo ""

exec nginx -c "$RUNTIME_CONF" -g 'daemon off;'
