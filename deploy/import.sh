#!/usr/bin/env bash
# Imports the content of the old Joomla site into the new one:
#   news (with their photo galleries), events (exhibitions, excursions, meetings ...),
#   photo albums (one per news gallery) and the museum hall texts.
# Safe to re-run: it updates what an earlier run created instead of duplicating it.
# Works on servers set up with deploy/setup.sh and on manually installed ones.
#
#   sudo bash deploy/import.sh              # import / refresh
#   sudo bash deploy/import.sh --dry-run    # only show what would be imported
#   sudo bash deploy/import.sh --proxy socks5://127.0.0.1:10808   # Go downloads through a proxy
#
# The old site is found automatically (configuration.php in /var/www/museum, /var/www/museumweb,
# /var/www/html); override with LEGACY_DIR=/path/to/joomla. Its database credentials are read from
# configuration.php; override with LEGACY_DSN='user:pass@tcp(host:3306)/db?charset=utf8mb4&parseTime=True'.
# The new site's database and upload folder come from backend/.env.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
. "$SCRIPT_DIR/lib.sh"
require_root "$@"
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
BACKEND=$APP_DIR/backend
[ -f "$BACKEND/.env" ] || die "$BACKEND/.env not found - the new site's backend is not configured here."

EXTRA=()
PROXY=${PROXY:-}
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) EXTRA+=(-dry-run) ;;
    --proxy) PROXY=${2:-}; [ -n "$PROXY" ] || die "--proxy needs a URL, e.g. socks5://127.0.0.1:10808"; shift ;;
    --proxy=*) PROXY=${1#*=} ;;
    *) die "Unknown option: $1" ;;
  esac
  shift
done
if [ -n "$PROXY" ]; then
  [[ $PROXY == *://* ]] || PROXY="http://$PROXY"
  # Go module downloads (and curl, if Go itself must be installed) go through the proxy.
  export HTTP_PROXY=$PROXY HTTPS_PROXY=$PROXY ALL_PROXY=$PROXY http_proxy=$PROXY https_proxy=$PROXY all_proxy=$PROXY
  export NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost
  log "Using proxy $PROXY"
fi

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

# --- 2. build the importer from the current checkout ---------------------------------------
want=$(sed -n 's/^go \([0-9][0-9.]*\).*/\1/p' "$BACKEND/go.mod")
[[ $want =~ ^[0-9]+\.[0-9]+$ ]] && want="$want.0"
GO=""
for g in "$(command -v go 2>/dev/null || true)" /usr/local/go/bin/go /usr/bin/go /snap/bin/go; do
  [ -n "$g" ] && [ -x "$g" ] || continue
  have=$("$g" env GOVERSION 2>/dev/null | sed 's/^go//')
  if [ -n "$have" ] && version_ge "$have" "$want"; then GO=$g; break; fi
done
if [ -z "$GO" ]; then
  ensure_go
  GO=/usr/local/go/bin/go
fi
log "Building the importer ($("$GO" version | cut -d' ' -f3))"
# Modules already downloaded by the user who ran sudo (or the backend owner) are read from their
# Go cache first, so only new dependencies need the network.
goproxy=""
for h in "$(getent passwd "${SUDO_USER:-}" | cut -d: -f6)" "$(getent passwd "$(stat -c %U "$BACKEND")" | cut -d: -f6)"; do
  [ -n "$h" ] && [ -d "$h/go/pkg/mod/cache/download" ] || continue
  case ",$goproxy," in *",file://$h/go/pkg/mod/cache/download,"*) continue ;; esac
  goproxy+="file://$h/go/pkg/mod/cache/download,"
done
goproxy+="${GOPROXY:-https://proxy.golang.org|https://goproxy.io|direct}"
if ! (cd "$BACKEND" && GOTOOLCHAIN=local GOPROXY="$goproxy" GOFLAGS=-modcacherw \
  "$GO" build -trimpath -ldflags '-s -w' -o bin/import ./cmd/import); then
  [ -n "$PROXY" ] && die "Building the importer failed (Go modules could not be downloaded through $PROXY)."
  die "Building the importer failed. If the server reaches the internet only through a proxy:
   sudo bash deploy/import.sh --proxy socks5://127.0.0.1:10808"
fi

# --- 3. run -------------------------------------------------------------------------------
log "Importing (copies photos into the upload folder, this can take a few minutes)"
(cd "$BACKEND" && ./bin/import -legacy-dsn "$LEGACY_DSN" -legacy-files "$LEGACY_DIR" -prefix "$PREFIX" "${EXTRA[@]}")

if [[ " ${EXTRA[*]} " != *" -dry-run "* ]]; then
  # Files were written as root: give them to whoever owns the backend so the API can serve them.
  upl=$(sed -nE 's/^UPLOAD_DIR=(.*)$/\1/p' "$BACKEND/.env" | tail -n1)
  upl=${upl:-./uploads}
  case $upl in /*) ;; *) upl=$BACKEND/${upl#./} ;; esac
  owner=$(stat -c '%U:%G' "$BACKEND")
  [ -d "$upl/legacy" ] && chown -R "$owner" "$upl/legacy" && chmod -R a+rX "$upl/legacy"
  touch "$APP_DIR/.legacy-imported" 2>/dev/null || true
  log "Done. Photos are in $upl/legacy. The website shows the new content within a minute (page cache)."
  log "Check: /tk/news  /tk/events  /tk/gallery"
fi
