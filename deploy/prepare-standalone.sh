#!/usr/bin/env bash
# Copy Next standalone output plus public/ and static assets into a destination.
# When NEXT_DIST_DIR is set (release builds use .next-build), static files live
# under that folder name inside standalone — not always `.next/static`.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="${NEXT_DIST_DIR:-.next}"
SRC="$APP_DIR/$DIST_DIR/standalone"
DEST="${STANDALONE_DEST:-$SRC}"

if [ ! -f "$SRC/server.js" ]; then
  echo "Standalone server is missing at $SRC/server.js. Run npm run build first." >&2
  exit 1
fi

if [ ! -d "$APP_DIR/$DIST_DIR/static" ]; then
  echo "Missing $APP_DIR/$DIST_DIR/static. Run npm run build first." >&2
  exit 1
fi

if [ "$DEST" != "$SRC" ]; then
  rm -rf "$DEST"
  cp -a "$SRC" "$DEST"
fi

rm -rf "$DEST/public" "$DEST/$DIST_DIR/static"
mkdir -p "$DEST/$DIST_DIR"
cp -a "$APP_DIR/public" "$DEST/public"
cp -a "$APP_DIR/$DIST_DIR/static" "$DEST/$DIST_DIR/static"
