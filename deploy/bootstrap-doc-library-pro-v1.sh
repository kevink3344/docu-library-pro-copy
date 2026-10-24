#!/usr/bin/env bash
# =============================================================================
# bootstrap-doc-library-pro-v1.sh
#
# Idempotently adds (or refreshes) the Apache reverse-proxy block for the
# Docu Library Pro v1 app inside the carmen8devlkk vhost, then validates and
# reloads httpd.
#
# Modeled on deploy/bootstrap-oracle-data-v2.sh conventions:
#   - BEGIN/END marker block so re-runs replace rather than duplicate
#   - ProxyPass with trailing slashes on BOTH sides (strips the prefix)
#   - RedirectMatch for the no-trailing-slash case
#   - apachectl configtest gate; auto-restore from backup on failure
#
# Usage (on the server, with sudo):
#   sudo ./deploy/bootstrap-doc-library-pro-v1.sh
#
# Overridable via env:
#   APP_SLUG      default: doc-library-pro-v1
#   APP_PORT      default: 3002
#   HTTPD_CONF    default: /etc/httpd/conf.d/sandbox.conf
#   VHOST_MATCH   default: devlkk      (substring identifying the target vhost)
# =============================================================================
set -euo pipefail

APP_SLUG="${APP_SLUG:-doc-library-pro-v1}"
APP_PORT="${APP_PORT:-3002}"
HTTPD_CONF="${HTTPD_CONF:-/etc/httpd/conf.d/sandbox.conf}"
VHOST_MATCH="${VHOST_MATCH:-devlkk}"

BEGIN_MARK="# ── BEGIN ${APP_SLUG} ──"
END_MARK="# ── END ${APP_SLUG} ──"

log()  { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[bootstrap]\033[0m %s\n' "$*" >&2; exit 1; }

# --- Preconditions -----------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "Must run as root (use sudo)."
[ -f "$HTTPD_CONF" ] || die "Apache config not found: $HTTPD_CONF"
command -v apachectl >/dev/null 2>&1 || die "apachectl not found in PATH."

log "App slug : $APP_SLUG"
log "App port : $APP_PORT"
log "Config   : $HTTPD_CONF"
log "Vhost    : matches '$VHOST_MATCH'"

# --- Sanity: is the app actually listening? ----------------------------------
if command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${APP_PORT}$"; then
    log "Port ${APP_PORT} is listening — good."
  else
    warn "Nothing is listening on port ${APP_PORT}. The proxy will 503 until the app is started."
  fi
fi

# --- Backup ------------------------------------------------------------------
BACKUP="${HTTPD_CONF}.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$HTTPD_CONF" "$BACKUP"
log "Backup written: $BACKUP"

# --- Build the block ---------------------------------------------------------
read -r -d '' BLOCK <<EOF || true
    ${BEGIN_MARK}
    #   Trailing slashes on BOTH the location and the target are required so the
    #   /${APP_SLUG} prefix is stripped before forwarding:
    #     /${APP_SLUG}/api/health -> http://127.0.0.1:${APP_PORT}/api/health
    #   The app runs with BASE_PATH=/${APP_SLUG}, so it expects the prefix removed.
    ProxyPass        /${APP_SLUG}/ http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse /${APP_SLUG}/ http://127.0.0.1:${APP_PORT}/
    RedirectMatch permanent ^/${APP_SLUG}\$ /${APP_SLUG}/
    # ── END ${APP_SLUG} ──
EOF

# --- Apply -------------------------------------------------------------------
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if grep -qF "$BEGIN_MARK" "$HTTPD_CONF"; then
  # Replace the existing block in place (BEGIN..END inclusive)
  log "Existing block found — replacing it."
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" -v block="$BLOCK" '
    index($0, b) { print block; skip=1; next }
    skip && index($0, e) { skip=0; next }
    skip { next }
    { print }
  ' "$HTTPD_CONF" > "$TMP"
else
  # Insert the block just before the </VirtualHost> that closes the target vhost.
  # We find the vhost by its DocumentRoot line (which contains VHOST_MATCH), then
  # insert immediately before the next </VirtualHost> after that point.
  log "No existing block — inserting a new one into the '$VHOST_MATCH' vhost."
  awk -v match="$VHOST_MATCH" -v block="$BLOCK" '
    BEGIN { seen=0; inserted=0 }
    {
      # Once we have seen the target vhost, insert before its closing tag.
      if (seen && !inserted && $0 ~ /<\/VirtualHost>/) {
        print block
        inserted=1
      }
      print
      if (!seen && $0 ~ /DocumentRoot/ && index($0, match) > 0) seen=1
    }
    END { if (!inserted) exit 3 }
  ' "$HTTPD_CONF" > "$TMP" || {
    warn "Could not auto-locate the '$VHOST_MATCH' vhost (no matching DocumentRoot + </VirtualHost>)."
    warn "Restoring backup; add the block manually."
    cp -a "$BACKUP" "$HTTPD_CONF"
    die "Insertion failed."
  }
fi

# --- Validate before installing ---------------------------------------------
# configtest reads the on-disk config, so install first, then test, and restore
# from the backup if the test fails.
install -m 0644 -o root -g root "$TMP" "$HTTPD_CONF"

if ! apachectl configtest >/tmp/configtest.out 2>&1; then
  warn "apachectl configtest FAILED with the new block:"
  sed 's/^/    /' /tmp/configtest.out >&2
  warn "Restoring backup — config left unchanged."
  cp -a "$BACKUP" "$HTTPD_CONF"
  die "Aborted; httpd not reloaded."
fi
log "configtest: Syntax OK"

# --- Reload ------------------------------------------------------------------
if systemctl is-active --quiet httpd; then
  systemctl reload httpd
  log "httpd reloaded."
elif systemctl is-active --quiet apache2; then
  systemctl reload apache2
  log "apache2 reloaded."
else
  warn "Neither httpd nor apache2 is active — not reloading."
fi

# --- Verify ------------------------------------------------------------------
log "Proxy block:"
grep -nF "$BEGIN_MARK" -A6 "$HTTPD_CONF" | sed 's/^/    /'

log "Done. Verify with:"
cat <<EOF
    curl -sI https://carmen8devlkk.wcpss.net/${APP_SLUG}/ | head -5
    curl -s  https://carmen8devlkk.wcpss.net/${APP_SLUG}/api/health; echo
EOF
