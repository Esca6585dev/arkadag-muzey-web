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
# It writes into the database and upload folder the RUNNING API uses (falls back to backend/.env).
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

# --- 3. target: the database and upload folder the RUNNING API uses ----------------------
# The live API may have been started with other settings than backend/.env (PM2 environment,
# another folder); then imported rows land where the website never looks. So the importer
# writes into whatever the running API reads: its process environment, else the .env in its folder.
envget() { sed -nE "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*[\"']?([^\"']*)[\"']?[[:space:]]*$/\1/p" "$2" 2>/dev/null | tail -n1; }
ports="$(envget APP_PORT "$BACKEND/.env")"
for f in "$APP_DIR/frontend/.env.production" "$APP_DIR/frontend/.env.production.local" "$APP_DIR/frontend/.env.local"; do
  u=$(envget API_URL "$f")
  [[ $u =~ :([0-9]+) ]] && ports+=" ${BASH_REMATCH[1]}"
done
ports+=" 8080 8085"
API_PID="" API_PORT=""
for p in $ports; do
  pid=$(ss -ltnpH "sport = :$p" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -n1 | cut -d= -f2 || true)
  [ -n "$pid" ] || continue
  if curl -fs --max-time 5 "http://127.0.0.1:$p/api/v1/health" | grep -q '"status"'; then API_PID=$pid API_PORT=$p; break; fi
done

if [ -n "$API_PID" ]; then
  API_CWD=$(readlink -f "/proc/$API_PID/cwd")
  procenv() { tr '\0' '\n' <"/proc/$API_PID/environ" | sed -nE "s/^$1=(.*)$/\1/p" | tail -n1; }
  setting() {
    local v
    v=$(procenv "$1")
    [ -n "$v" ] || v=$(envget "$1" "$API_CWD/.env")
    printf '%s' "${v:-$2}"
  }
  export DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME UPLOAD_DIR
  DB_HOST=$(setting DB_HOST 127.0.0.1) DB_PORT=$(setting DB_PORT 3306) DB_USER=$(setting DB_USER root)
  DB_PASSWORD=$(setting DB_PASSWORD "") DB_NAME=$(setting DB_NAME arkadag_museum)
  UPLOAD_DIR=$(setting UPLOAD_DIR ./uploads)
  case $UPLOAD_DIR in /*) ;; *) UPLOAD_DIR=$API_CWD/${UPLOAD_DIR#./} ;; esac
  FILE_OWNER=$(ps -o user= -p "$API_PID" | tr -d ' ')
  log "Live API: port $API_PORT, pid $API_PID, folder $API_CWD"
  log "Importing into the database the site reads: $DB_NAME on $DB_HOST:$DB_PORT (user $DB_USER), photos into $UPLOAD_DIR"
  file_db=$(envget DB_NAME "$BACKEND/.env")
  if [ "${file_db:-arkadag_museum}" != "$DB_NAME" ] || [ "$API_CWD" != "$BACKEND" ]; then
    warn "backend/.env points elsewhere (database '${file_db:-arkadag_museum}') - that is why earlier imports did not show up on the site."
  fi
else
  warn "No running API found (ports tried: $ports) - importing into the database from backend/.env"
  UPLOAD_DIR=$(envget UPLOAD_DIR "$BACKEND/.env")
  UPLOAD_DIR=${UPLOAD_DIR:-./uploads}
  case $UPLOAD_DIR in /*) ;; *) UPLOAD_DIR=$BACKEND/${UPLOAD_DIR#./} ;; esac
  export UPLOAD_DIR
  FILE_OWNER=$(stat -c %U "$BACKEND")
fi

# --- 4. run -------------------------------------------------------------------------------
log "Importing (copies photos into the upload folder, this can take a few minutes)"
(cd "$BACKEND" && ./bin/import -legacy-dsn "$LEGACY_DSN" -legacy-files "$LEGACY_DIR" -prefix "$PREFIX" "${EXTRA[@]}")

if [[ " ${EXTRA[*]} " != *" -dry-run "* ]]; then
  # Files were written as root: hand them to the user the API runs as, so it can serve them.
  if [ -d "$UPLOAD_DIR/legacy" ]; then
    [ "$FILE_OWNER" != root ] && chown -R "$FILE_OWNER:$(id -gn "$FILE_OWNER")" "$UPLOAD_DIR/legacy"
    chmod -R a+rX "$UPLOAD_DIR/legacy"
  fi
  touch "$APP_DIR/.legacy-imported" 2>/dev/null || true
  log "Photos are in $UPLOAD_DIR/legacy."
  if [ -n "$API_PORT" ]; then
    count() { curl -s --max-time 10 -H 'X-Locale: tk' "http://127.0.0.1:$API_PORT/api/v1/public/$1" | grep -oE '"total":[0-9]+' | cut -d: -f2; }
    log "The live API now returns: news (tk) $(count 'articles?limit=1&locale=tk'), past events (tk) $(count 'events?past=true&limit=1&locale=tk'), albums (tk) $(count 'galleries?limit=1&locale=tk')"
  fi
  log "Done. Pages show the new content within a minute (page cache): /tk/news  /tk/events  /tk/gallery"
fi
