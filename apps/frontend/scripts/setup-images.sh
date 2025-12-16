#!/bin/bash

# Setup script for symlinking recipe images to public directory
# This enables Next.js to serve images statically for optimal performance

set -e

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

UPLOADS_DIR="$SCRIPT_DIR/../public/uploads"
DATA_FILES_DIR="$PROJECT_ROOT/data/files"

echo "Setting up recipe image symlinks..."
echo "Source: $DATA_FILES_DIR"
echo "Target: $UPLOADS_DIR"

# Create uploads directory if it doesn't exist
mkdir -p "$UPLOADS_DIR"

# Check if data/files directory exists
if [ ! -d "$DATA_FILES_DIR" ]; then
    echo "Error: Data files directory not found: $DATA_FILES_DIR"
    echo "Please ensure the data/files directory exists with recipe images."
    exit 1
fi

# Count existing images
IMAGE_COUNT=$(find "$DATA_FILES_DIR" -name "*.webp" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.avif" | wc -l | tr -d ' ')

if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo "Warning: No images found in $DATA_FILES_DIR"
    echo "The uploads directory will be empty."
    exit 0
fi

# Remove existing symlinks (but keep README.md and .gitignore)
find "$UPLOADS_DIR" -type l -delete

# Create symlinks for all image files
ln -sf "$DATA_FILES_DIR"/*.{webp,jpg,jpeg,png,avif} "$UPLOADS_DIR/" 2>/dev/null || true

# Count created symlinks
SYMLINK_COUNT=$(find "$UPLOADS_DIR" -type l | wc -l | tr -d ' ')

echo "Successfully created $SYMLINK_COUNT symlinks for recipe images."
echo "Images are now accessible at /uploads/[filename]"
