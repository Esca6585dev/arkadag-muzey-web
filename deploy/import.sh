#!/usr/bin/env bash
# Imports the content of the old Joomla site into the new one:
#   news (with their photo galleries), events (exhibitions, excursions, meetings ...),
#   photo albums (one per news gallery) and the museum hall texts.
# Safe to re-run: it updates what an earlier run created instead of duplicating it.
#
#   sudo bash deploy/import.sh              # import / refresh
#   sudo bash deploy/import.sh --dry-run    # only show what would be imported
#
# The old site is found automatically (configuration.php in /var/www/museum, /var/www/museumweb,
# /var/www/html); override with LEGACY_DIR=/path/to/joomla. Its database credentials are read from
# configuration.php; override with LEGACY_DSN='user:pass@tcp(host:3306)/db?charset=utf8mb4&parseTime=True'.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
. "$SCRIPT_DIR/lib.sh"
require_root "$@"
load_conf
[ -f "$CONF_FILE" ] || die "Run 'sudo bash deploy/setup.sh' first."

EXTRA=()
for arg in "$@"; do
  case $arg in
    --dry-run) EXTRA+=(-dry-run) ;;
    *) die "Unknown option: $arg" ;;
  esac
done

# --- 1. locate the old Joomla site -------------------------------------------------------
if [ -z "${LEGACY_DIR:-}" ]; then
  for d in /var/www/museum /var/www/museumweb /var/www/html /var/www/museum_old; do
    if [ -f "$d/configuration.php" ] && [ -d "$d/images" ]; then LEGACY_DIR=$d; break; fi
  done
fi
[ -n "${LEGACY_DIR:-}" ] && [ -f "$LEGACY_DIR/configuration.php" ] || die "Old Joomla site not found.
   Set its folder:  sudo LEGACY_DIR=/var/www/<folder> bash deploy/import.sh
   If it was removed, restore the backup first, e.g.:
     sudo mkdir -p /var/www/museum && sudo tar -xzf site_files.tar.gz -C /var/www   (creates /var/www/museum)
     mysql -u root -p -e 'CREATE DATABASE museum_db CHARACTER SET utf8mb4' && mysql -u root -p museum_db < database.sql"
JCONF=$LEGACY_DIR/configuration.php
log "Old site: $LEGACY_DIR"

jget() { sed -nE "s/^[[:space:]]*public \\\$$1[[:space:]]*=[[:space:]]*'([^']*)'.*/\1/p" "$JCONF" | head -n1; }
PREFIX=$(jget dbprefix)
if [ -z "${LEGACY_DSN:-}" ]; then
  jhost=$(jget host)
  sock=$(ls /var/run/mysqld/mysqld.sock /run/mysqld/mysqld.sock 2>/dev/null | head -n1 || true)
  if { [ "$jhost" = localhost ] || [ -z "$jhost" ]; } && [ -n "$sock" ]; then
    addr="unix($sock)" # Joomla's 'user'@'localhost' account matches socket connections
  else
    [ "$jhost" = localhost ] && jhost=127.0.0.1
    [[ $jhost == *:* ]] || jhost="$jhost:3306"
    addr="tcp($jhost)"
  fi
  LEGACY_DSN="$(jget user):$(jget password)@$addr/$(jget db)?charset=utf8mb4&parseTime=True"
fi
log "Old database: $(jget db) (table prefix ${PREFIX:-none})"

# The app user only needs to read the old images.
if ! sudo -u "$APP_USER" test -r "$LEGACY_DIR/images"; then
  warn "$APP_USER cannot read $LEGACY_DIR/images - granting read access"
  chmod -R o+rX "$LEGACY_DIR/images"
fi

# --- 2. build the importer from the current checkout ---------------------------------------
log "Building the importer"
as_app bash -c "cd '$APP_DIR/backend' && go build -trimpath -ldflags '-s -w' -o bin/import ./cmd/import"

# --- 3. run -------------------------------------------------------------------------------
log "Importing (copies photos to backend/uploads/legacy, this can take a few minutes)"
as_app env -C "$APP_DIR/backend" ./bin/import -legacy-dsn "$LEGACY_DSN" -legacy-files "$LEGACY_DIR" -prefix "$PREFIX" "${EXTRA[@]}"

if [[ " ${EXTRA[*]} " != *" -dry-run "* ]]; then
  as_app touch "$(getent passwd "$APP_USER" | cut -d: -f6)/.legacy-imported"
  log "Done. The website shows the imported content within a minute (page cache)."
  log "Check: https://$DOMAIN/tk/news  /tk/events  /tk/gallery"
fi
