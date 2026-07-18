#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/blackhawk/prayer-pwa"
STANDALONE_DIR="$APP_DIR/.next/standalone"

if [ ! -f "$STANDALONE_DIR/server.js" ]; then
  echo "Standalone server is missing. Run npm run build first." >&2
  exit 1
fi

rm -rf "$STANDALONE_DIR/public" "$STANDALONE_DIR/.next/static"
mkdir -p "$STANDALONE_DIR/.next"

cp -R "$APP_DIR/public" "$STANDALONE_DIR/public"
cp -R "$APP_DIR/.next/static" "$STANDALONE_DIR/.next/static"
