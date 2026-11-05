#!/usr/bin/env bash
# Gets the latest code from GitHub (optionally through a proxy) and rebuilds the site.
# Works on servers set up with deploy/setup.sh and on servers set up by hand.
#
#   sudo bash deploy/pull.sh                                    # pull + rebuild
#   sudo bash deploy/pull.sh --proxy socks5://127.0.0.1:10808   # pull + rebuild through a proxy
#   sudo bash deploy/pull.sh --proxy http://10.0.0.5:3128 --import
#   sudo PROXY=http://10.0.0.5:3128 bash deploy/pull.sh
#
# Options:
#   --proxy URL   http://, https://, socks5:// or socks5h:// proxy for git, Go and npm downloads
#   --import      also run deploy/import.sh (old Joomla news, events, albums) after the rebuild
#   --no-build    only pull, do not rebuild
#   --stash       put local edits of tracked files aside (git stash); without it, edits made on the
#                 server are kept unless the update changes the same files (then it stops)
#
# Rebuild step: deploy/deploy.sh when /etc/arkadag-muzey-web.env exists (setup.sh install),
# otherwise safe-rebuild-museum.sh in the project folder (hand-made install).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
. "$SCRIPT_DIR/lib.sh"

case "${1:-}" in -h | --help) sed -n '2,18p' "$0"; exit 0 ;; esac
require_root "$@"

APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
BRANCH=${BRANCH:-main}
PROXY=${PROXY:-}
DO_IMPORT=0
DO_BUILD=1
STASH=0
while [ $# -gt 0 ]; do
  case $1 in
    --proxy) PROXY=${2:-}; [ -n "$PROXY" ] || die "--proxy needs a URL, e.g. socks5://127.0.0.1:10808"; shift ;;
    --proxy=*) PROXY=${1#*=} ;;
    --import) DO_IMPORT=1 ;;
    --no-build) DO_BUILD=0 ;;
    --stash) STASH=1 ;;
    *) die "Unknown option: $1 (see: bash deploy/pull.sh --help)" ;;
  esac
  shift
done

if [ -n "$PROXY" ] && [[ ! $PROXY =~ ^(https?|socks5h?|socks4a?)://[^[:space:]]+$ ]]; then
  warn "Proxy has no scheme, assuming http://$PROXY"
  PROXY="http://$PROXY"
fi

GIT=(git -C "$APP_DIR" -c "safe.directory=$APP_DIR")
if [ -n "$PROXY" ]; then
  GIT+=(-c "http.proxy=$PROXY" -c "https.proxy=$PROXY")
  # Go, npm and curl (toolchain downloads) read these; local health checks bypass the proxy.
  export HTTP_PROXY=$PROXY HTTPS_PROXY=$PROXY ALL_PROXY=$PROXY http_proxy=$PROXY https_proxy=$PROXY all_proxy=$PROXY
  export NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost
  log "Using proxy $PROXY"
fi

[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a git checkout"
OWNER=$(stat -c %U "$APP_DIR")
GROUP=$(stat -c %G "$APP_DIR")

# --- 1. reach GitHub ---------------------------------------------------------------------
REMOTE=$("${GIT[@]}" remote get-url origin)
log "Checking $REMOTE"
if ! timeout 40 "${GIT[@]}" ls-remote --heads origin "$BRANCH" >/dev/null 2>&1; then
  if [ -n "$PROXY" ]; then
    die "GitHub is not reachable through $PROXY. Check that the proxy is running on the server."
  fi
  die "GitHub is not reachable. If the server needs a proxy: sudo bash deploy/pull.sh --proxy socks5://HOST:PORT"
fi

# --- 2. fetch and check local edits ------------------------------------------------------
BEFORE=$("${GIT[@]}" rev-parse HEAD)
log "Fetching $BRANCH"
"${GIT[@]}" fetch --quiet origin "$BRANCH"

# Edits made on the server (e.g. hand fixes) are kept as long as the update does not touch
# the same files - like a plain `git pull`. Only overlapping files stop the update.
EDITED=$("${GIT[@]}" diff --name-only HEAD)
if [ -n "$EDITED" ]; then
  INCOMING=$("${GIT[@]}" diff --name-only HEAD "origin/$BRANCH")
  OVERLAP=$(comm -12 <(sort <<<"$EDITED") <(sort <<<"$INCOMING"))
  if [ "$STASH" = 1 ]; then
    warn "Putting local edits aside (git stash):"
    printf '   %s\n' $EDITED >&2
    "${GIT[@]}" stash push --quiet -m "pull.sh $(date '+%F %T')"
    warn "They are kept in: git stash list (restore with: git stash pop)"
  elif [ -n "$OVERLAP" ]; then
    printf '   %s\n' $OVERLAP >&2
    die "These files were edited on the server AND are changed by the update.
   Look at the server edits:  sudo git -C $APP_DIR -c safe.directory=$APP_DIR diff
   Drop them and update:      sudo bash deploy/pull.sh --stash"
  else
    warn "Keeping files edited on the server (the update does not touch them):"
    printf '   %s\n' $EDITED >&2
  fi
fi

# --- 3. pull -------------------------------------------------------------------------------
log "Updating to origin/$BRANCH"
"${GIT[@]}" merge --ff-only --quiet "origin/$BRANCH" ||
  die "The server copy has its own commits; it cannot be fast-forwarded to origin/$BRANCH."
AFTER=$("${GIT[@]}" rev-parse HEAD)
if [ "$OWNER" != root ]; then
  chown -R "$OWNER:$GROUP" "$APP_DIR"
fi

if [ "$BEFORE" = "$AFTER" ]; then
  log "Already up to date: $("${GIT[@]}" log -1 --format='%h %s')"
else
  log "New commits:"
  "${GIT[@]}" --no-pager log --oneline "$BEFORE..$AFTER"
  "${GIT[@]}" --no-pager diff --stat "$BEFORE" "$AFTER" | tail -n1
fi

# --- 4. rebuild ----------------------------------------------------------------------------
if [ "$DO_BUILD" = 1 ]; then
  if [ -f "$CONF_FILE" ]; then
    log "Rebuilding with deploy/deploy.sh"
    bash "$SCRIPT_DIR/deploy.sh" --no-pull
  elif [ -f "$APP_DIR/safe-rebuild-museum.sh" ]; then
    log "Rebuilding with safe-rebuild-museum.sh"
    bash "$APP_DIR/safe-rebuild-museum.sh"
  else
    warn "No rebuild step found (no $CONF_FILE and no $APP_DIR/safe-rebuild-museum.sh)."
    warn "Rebuild the backend and frontend the way this server was set up, or run: sudo bash deploy/setup.sh"
  fi
fi

# --- 5. import -----------------------------------------------------------------------------
if [ "$DO_IMPORT" = 1 ]; then
  log "Importing the old Joomla content"
  bash "$SCRIPT_DIR/import.sh"
fi

log "Done: $("${GIT[@]}" log -1 --format='%h %s (%cr)')"
