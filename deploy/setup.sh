#!/usr/bin/env bash
# First-time server setup for the Arkadag City Museum site on Ubuntu (no Docker):
# toolchains, app user, MySQL database, .env files, build, systemd services, nginx + SSL,
# and the one-time import of the old Joomla content.
#
#   sudo bash deploy/setup.sh [--yes] [--import | --no-import]
#
# Safe to re-run: existing .env files, passwords and data are kept.
# Overrides (environment): DOMAIN, API_PORT, WEB_PORT, APP_USER, BRANCH, SSL_CERT, SSL_KEY,
#   LEGACY_DIR (old Joomla root, auto-detected by deploy/import.sh), DB_NAME, DB_USER, MYSQL_ROOT_PASSWORD.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
. "$SCRIPT_DIR/lib.sh"
require_root "$@"

ASSUME_YES=0
IMPORT=auto
for arg in "$@"; do
  case $arg in
    --yes | -y) ASSUME_YES=1 ;;
    --import) IMPORT=yes ;;
    --no-import) IMPORT=no ;;
    *) die "Unknown option: $arg" ;;
  esac
done

confirm() {
  [ "$ASSUME_YES" = 1 ] && return 0
  local reply
  read -r -p "$1 [y/N] " reply
  [[ $reply =~ ^[YyHh] ]]
}

env_get() { grep -E "^$1=" "$2" 2>/dev/null | tail -n1 | cut -d= -f2-; }

APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
load_conf
LEGACY_DIR_SET=${LEGACY_DIR:-}
DB_NAME=${DB_NAME:-arkadag_museum}
DB_USER=${DB_USER:-museum}
BACKEND_ENV=$APP_DIR/backend/.env
FRONTEND_ENV=$APP_DIR/frontend/.env.production.local

case $APP_DIR in
  /home/* | /root/*) die "Clone the project outside home directories (e.g. /var/www/arkadag-muzey-web); the services cannot read $APP_DIR." ;;
esac
[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a git checkout"

log "Project: $APP_DIR  domain: $DOMAIN  api: 127.0.0.1:$API_PORT  web: 127.0.0.1:$WEB_PORT"

# --- 1. System packages --------------------------------------------------------------
missing=()
for p in git curl ca-certificates xz-utils openssl nginx; do
  dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
done
if ! command -v mysql >/dev/null 2>&1; then
  missing+=(mariadb-server)
fi
if ((${#missing[@]})); then
  log "Installing packages: ${missing[*]}"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}"
fi

ensure_go
ensure_node

# --- 2. App user and ownership ---------------------------------------------------------
if ! id "$APP_USER" >/dev/null 2>&1; then
  log "Creating system user $APP_USER"
  useradd --system --home-dir "/var/lib/$APP_USER" --create-home --shell /usr/sbin/nologin "$APP_USER"
fi
APP_HOME=$(getent passwd "$APP_USER" | cut -d: -f6)
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
git config --system --get-all safe.directory 2>/dev/null | grep -qx "$APP_DIR" ||
  git config --system --add safe.directory "$APP_DIR"

port_in_use() { ss -Hltn "sport = :$1" | grep -q .; }
if ! systemctl is-active --quiet museum-api && port_in_use "$API_PORT"; then
  die "Port $API_PORT is already used by another program. Re-run with API_PORT=<free port>."
fi
if ! systemctl is-active --quiet museum-web && port_in_use "$WEB_PORT"; then
  die "Port $WEB_PORT is already used by another program. Re-run with WEB_PORT=<free port>."
fi
save_conf

# --- 3. Database -----------------------------------------------------------------------
mysql_root() {
  if [ -n "${MYSQL_ROOT_PASSWORD:-}" ]; then
    MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$@"
  else
    mysql -uroot "$@"
  fi
}
if ! mysql_root -e 'SELECT 1' >/dev/null 2>&1; then
  read -r -s -p "MySQL root password: " MYSQL_ROOT_PASSWORD
  echo
  mysql_root -e 'SELECT 1' >/dev/null 2>&1 || die "Cannot connect to MySQL as root"
fi

DB_PASS=$(env_get DB_PASSWORD "$BACKEND_ENV")
[ -n "$DB_PASS" ] || DB_PASS=$(openssl rand -hex 16)
log "Preparing database $DB_NAME (user $DB_USER)"
mysql_root <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# --- 4. Environment files ---------------------------------------------------------------
NEW_ADMIN_PASSWORD=""
if [ ! -f "$BACKEND_ENV" ]; then
  NEW_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | cut -c1-14)
  log "Writing backend/.env"
  cat >"$BACKEND_ENV" <<EOF
APP_ENV=production
APP_HOST=127.0.0.1
APP_PORT=$API_PORT
APP_URL=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN
CORS_ORIGINS=https://$DOMAIN

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME

JWT_SECRET=$(openssl rand -hex 32)
JWT_ACCESS_TTL_MINUTES=60
JWT_REFRESH_TTL_DAYS=30
COOKIE_SECURE=true
COOKIE_DOMAIN=

UPLOAD_DIR=./uploads
UPLOAD_URL=/uploads
MAX_UPLOAD_MB=20

ADMIN_NAME=Administrator
ADMIN_EMAIL=admin@$DOMAIN
ADMIN_PASSWORD=$NEW_ADMIN_PASSWORD
EOF
else
  log "Keeping existing backend/.env"
  [ "$(env_get APP_PORT "$BACKEND_ENV")" = "$API_PORT" ] || warn "APP_PORT in backend/.env differs from API_PORT=$API_PORT"
fi
cat >"$FRONTEND_ENV" <<EOF
API_URL=http://127.0.0.1:$API_PORT
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
EOF
chown "$APP_USER:$APP_USER" "$BACKEND_ENV" "$FRONTEND_ENV"
chmod 600 "$BACKEND_ENV"
chmod 640 "$FRONTEND_ENV"
as_app mkdir -p "$APP_DIR/backend/uploads"

# --- 5. Build and start services -----------------------------------------------------
build_backend
build_frontend
activate_release

log "Installing systemd services"
for unit in museum-api museum-web; do
  sed -e "s#@APP_DIR@#$APP_DIR#g" -e "s#@APP_USER@#$APP_USER#g" -e "s#@WEB_PORT@#$WEB_PORT#g" \
    "$SCRIPT_DIR/templates/$unit.service" >"/etc/systemd/system/$unit.service"
done
systemctl daemon-reload
systemctl enable --quiet museum-api museum-web
restart_services || die "Services did not start - see the logs above"

# --- 6. One-time import of the old Joomla content ---------------------------------------
# deploy/import.sh finds the old site itself (or uses LEGACY_DIR) and can be re-run any time.
IMPORT_MARK=$APP_HOME/.legacy-imported
if [ "$IMPORT" = auto ]; then
  IMPORT=no
  if [ ! -f "$IMPORT_MARK" ] && confirm "Import news, events, photo albums and hall texts from the old Joomla site?"; then
    IMPORT=yes
  fi
fi
if [ "$IMPORT" = yes ]; then
  LEGACY_DIR=${LEGACY_DIR_SET:-} bash "$SCRIPT_DIR/import.sh" || warn "Import failed - fix the cause and run: sudo bash deploy/import.sh"
fi

# --- 7. nginx + SSL ----------------------------------------------------------------------
SITE_NAME=arkadag-muzey-web
SITE_FILE=/etc/nginx/sites-available/$SITE_NAME.conf
mapfile -t conflicts < <(grep -lE "server_name[^;]*[[:space:]]$(sed 's/\./\\./g' <<<"$DOMAIN")([[:space:];]|$)" \
  /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf 2>/dev/null | grep -v "$SITE_NAME" || true)

if [ -z "${SSL_CERT:-}" ] && ((${#conflicts[@]})); then
  SSL_CERT=$(grep -hE '^[[:space:]]*ssl_certificate[[:space:]]' "${conflicts[@]}" | head -n1 | awk '{print $2}' | tr -d ';')
  SSL_KEY=$(grep -hE '^[[:space:]]*ssl_certificate_key[[:space:]]' "${conflicts[@]}" | head -n1 | awk '{print $2}' | tr -d ';')
  { [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; } || { SSL_CERT=""; SSL_KEY=""; }
  [ -n "$SSL_CERT" ] && log "Reusing the certificate of the current site: $SSL_CERT"
fi
if [ -z "${SSL_CERT:-}" ]; then
  src=$(getent passwd "${SUDO_USER:-root}" | cut -d: -f6)
  dst=/etc/nginx/ssl/$DOMAIN
  if [ -f "$src/private.key" ] && { [ -f "$src/fullchain.crt" ] || [ -f "$src/$DOMAIN.crt" ]; }; then
    log "Installing the certificate from $src into $dst"
    install -d -m 750 "$dst"
    if [ -f "$src/fullchain.crt" ]; then
      install -m 644 "$src/fullchain.crt" "$dst/fullchain.crt"
    else
      cat "$src/$DOMAIN.crt" "$src/ca_bundle.crt" >"$dst/fullchain.crt" 2>/dev/null || cp "$src/$DOMAIN.crt" "$dst/fullchain.crt"
    fi
    install -m 600 "$src/private.key" "$dst/private.key"
    SSL_CERT=$dst/fullchain.crt
    SSL_KEY=$dst/private.key
  fi
fi
[ -n "${SSL_CERT:-}" ] && [ -n "${SSL_KEY:-}" ] || die "No SSL certificate found. Re-run with SSL_CERT=/path/fullchain.crt SSL_KEY=/path/private.key"

MAX_BODY_MB=$(($(env_get MAX_UPLOAD_MB "$BACKEND_ENV" || echo 20) + 5))
log "Writing nginx site $SITE_FILE"
sed -e "s#@DOMAIN@#$DOMAIN#g" -e "s#@APP_DIR@#$APP_DIR#g" -e "s#@API_PORT@#$API_PORT#g" \
  -e "s#@WEB_PORT@#$WEB_PORT#g" -e "s#@SSL_CERT@#$SSL_CERT#g" -e "s#@SSL_KEY@#$SSL_KEY#g" \
  -e "s#@MAX_BODY_MB@#$MAX_BODY_MB#g" "$SCRIPT_DIR/templates/nginx.conf" >"$SITE_FILE"
[ -f /proc/net/if_inet6 ] || sed -i '/listen \[::\]/d' "$SITE_FILE"

DISABLED_DIR=/etc/nginx/disabled-by-$SITE_NAME
moved=()
if ((${#conflicts[@]})); then
  warn "These nginx configs also serve $DOMAIN (the old site): ${conflicts[*]}"
  if confirm "Disable them so the new site takes over? (they are moved to $DISABLED_DIR, files in /var/www stay untouched)"; then
    install -d "$DISABLED_DIR"
    for f in "${conflicts[@]}"; do
      echo "$f" >>"$DISABLED_DIR/RESTORE.txt"
      mv "$f" "$DISABLED_DIR/"
      moved+=("$f")
    done
  else
    warn "Old configs left enabled - nginx will warn about a conflicting server name and may keep serving the old site."
  fi
fi
ln -sf "$SITE_FILE" "/etc/nginx/sites-enabled/$SITE_NAME.conf"

if ! nginx -t; then
  warn "nginx config test failed - reverting nginx changes"
  rm -f "/etc/nginx/sites-enabled/$SITE_NAME.conf"
  for f in "${moved[@]}"; do mv "$DISABLED_DIR/$(basename "$f")" "$f"; done
  die "nginx -t failed; the old site is unchanged"
fi
systemctl reload nginx

# --- Done --------------------------------------------------------------------------------
log "Done: https://$DOMAIN"
echo "    Admin panel:   https://$DOMAIN/tk/admin"
if [ -n "$NEW_ADMIN_PASSWORD" ]; then
  echo "    Admin login:   admin@$DOMAIN"
  echo "    Password:      $NEW_ADMIN_PASSWORD   (change it after the first login)"
fi
echo "    Update later:  sudo bash $APP_DIR/deploy/deploy.sh"
echo "    Logs:          journalctl -u museum-api -f   |   journalctl -u museum-web -f"
