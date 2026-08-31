#!/usr/bin/env bash
# Zero-downtime production release:
#   1. Build into .next-build (does not touch the live standalone tree)
#   2. Migrate the database while the current slot is still serving
#   3. Start the idle slot, health-check it, point the :3000 proxy at it
#   4. Stop the previous slot
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RELEASES="$APP_DIR/releases"
UPSTREAM_FILE="$RELEASES/upstream.port"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-build}"

cd "$APP_DIR"
mkdir -p "$RELEASES"

log() { printf '[release] %s\n' "$*"; }

current_slot() {
  if [ -f "$UPSTREAM_FILE" ]; then
    tr -d '[:space:]' < "$UPSTREAM_FILE"
  fi
}

next_slot() {
  local current="${1:-}"
  if [ "$current" = "3001" ]; then
    echo 3002
  else
    echo 3001
  fi
}

fetch() {
  local port="$1" path="$2"
  curl -sf --max-time 6 -H "Host: fortwayneprays.org" "http://127.0.0.1:${port}${path}"
}

# HTML 200 is not enough — a missing CSS/JS bundle is the client "Application error".
slot_ready() {
  local port="$1"
  local html css js ctype
  html="$(fetch "$port" /)" || return 1
  printf '%s' "$html" | grep -qi '<html' || return 1
  printf '%s' "$html" | grep -qi 'application error' && return 1
  css="$(printf '%s' "$html" | grep -oE '/_next/static/css/[^" ]+' | head -1)"
  js="$(printf '%s' "$html" | grep -oE '/_next/static/chunks/[^" ]+\.js' | head -1)"
  [ -n "$css" ] && [ -n "$js" ] || return 1
  fetch "$port" "$css" >/dev/null || return 1
  fetch "$port" "$js" >/dev/null || return 1
  ctype="$(curl -sI --max-time 4 -H "Host: fortwayneprays.org" "http://127.0.0.1:${port}${css}" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')"
  printf '%s' "$ctype" | grep -qi 'text/css' || return 1
  for path in /auth /log /help; do
    fetch "$port" "$path" >/dev/null || return 1
  done
  return 0
}

wait_healthy() {
  local port="$1"
  local attempts="${2:-40}"
  local i
  for i in $(seq 1 "$attempts"); do
    if slot_ready "$port"; then
      log "slot :$port is healthy (html + css/js + key routes)"
      return 0
    fi
    sleep 1
  done
  log "slot :$port failed health checks (html or static assets)"
  return 1
}

install_units() {
  mkdir -p "$USER_UNIT_DIR"
  cp "$APP_DIR/deploy/prayer-pwa.service" "$USER_UNIT_DIR/prayer-pwa.service"
  cp "$APP_DIR/deploy/prayer-pwa-app@.service" "$USER_UNIT_DIR/prayer-pwa-app@.service"
  systemctl --user daemon-reload
  systemctl --user enable prayer-pwa.service >/dev/null
}

CURRENT="$(current_slot)"
NEW="$(next_slot "$CURRENT")"
DEST="$RELEASES/$NEW"

log "building into $NEXT_DIST_DIR (live slot ${CURRENT:-none} stays up)"
npm run build

log "applying database migrations"
npm run db:migrate

log "staging standalone into $DEST"
rm -rf "$DEST.tmp"
STANDALONE_DEST="$DEST.tmp" bash "$APP_DIR/deploy/prepare-standalone.sh"
rm -rf "$DEST"
mv "$DEST.tmp" "$DEST"

install_units

log "starting app slot :$NEW"
systemctl --user enable "prayer-pwa-app@${NEW}.service" >/dev/null
systemctl --user restart "prayer-pwa-app@${NEW}.service"
if ! wait_healthy "$NEW"; then
  log "new slot is not ready; keeping live traffic on :${CURRENT:-none}"
  systemctl --user disable --now "prayer-pwa-app@${NEW}.service" >/dev/null 2>&1 || true
  exit 1
fi

printf '%s\n' "$NEW" > "$UPSTREAM_FILE"

proxy_is_live() {
  local pid
  pid="$(systemctl --user show -p MainPID --value prayer-pwa.service 2>/dev/null || true)"
  if [ -z "$pid" ] || [ "$pid" = "0" ]; then
    return 1
  fi
  tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null | grep -q proxy.mjs
}

if proxy_is_live; then
  log "proxy already on :3000; flipped upstream to :$NEW"
  systemctl --user kill -s HUP prayer-pwa.service >/dev/null 2>&1 || true
elif systemctl --user is-active --quiet prayer-pwa.service; then
  log "replacing legacy :3000 app with proxy (brief first-cutover gap)"
  systemctl --user restart prayer-pwa.service
else
  log "starting proxy on :3000 → :$NEW"
  systemctl --user start prayer-pwa.service
fi

if ! wait_healthy 3000 20; then
  log "proxy health check failed; leaving new slot running for inspection"
  exit 1
fi

if [ -n "$CURRENT" ] && [ "$CURRENT" != "$NEW" ]; then
  log "draining old slot :$CURRENT"
  sleep 2
  systemctl --user disable --now "prayer-pwa-app@${CURRENT}.service" >/dev/null 2>&1 || true
fi

log "live: proxy :3000 → app :$NEW"
