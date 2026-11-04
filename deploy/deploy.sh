#!/usr/bin/env bash
# Updates the running site: git pull, build, swap in the new release, restart, health check.
# A failed health check rolls back to the previous release automatically.
#
#   sudo bash deploy/deploy.sh            # pull + build + restart
#   sudo bash deploy/deploy.sh --no-pull  # rebuild the current checkout
#   sudo bash deploy/deploy.sh rollback   # go back to the previous release
#   sudo bash deploy/deploy.sh restart    # only restart the services
#   sudo bash deploy/deploy.sh status     # service status + health
#
# Run deploy/setup.sh once before the first deploy.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
. "$SCRIPT_DIR/lib.sh"
require_root "$@"
load_conf
[ -f "$CONF_FILE" ] || die "Run 'sudo bash deploy/setup.sh' first."

rollback() {
  local be=$APP_DIR/backend/bin fe=$APP_DIR/frontend
  [ -f "$be/server.prev" ] || [ -d "$fe/.release-prev" ] || die "No previous release to roll back to."
  warn "Rolling back to the previous release"
  if [ -f "$be/server.prev" ]; then
    as_app mv -f "$be/server" "$be/server.failed" 2>/dev/null || true
    as_app mv -f "$be/server.prev" "$be/server"
  fi
  if [ -d "$fe/.release-prev" ]; then
    as_app rm -rf "$fe/.release-failed"
    [ -d "$fe/.release" ] && as_app mv "$fe/.release" "$fe/.release-failed"
    as_app mv "$fe/.release-prev" "$fe/.release"
  fi
  restart_services || die "Rollback did not come up either - check: journalctl -u museum-api -u museum-web -n 100"
}

status() {
  systemctl --no-pager --lines=0 status museum-api museum-web nginx || true
  curl -fsS "http://127.0.0.1:$API_PORT/api/v1/health" && echo
  curl -fsS -o /dev/null -w "website: %{http_code}\n" "http://127.0.0.1:$WEB_PORT/tk" || true
  echo "deployed commit: $(as_app git -C "$APP_DIR" log -1 --format='%h %s (%cr)')"
}

PULL=1
case "${1:-}" in
  rollback) rollback; exit 0 ;;
  restart) restart_services; exit 0 ;;
  status) status; exit 0 ;;
  --no-pull) PULL=0 ;;
  "") ;;
  *) die "Unknown argument: $1" ;;
esac

if [ "$PULL" = 1 ]; then
  log "Pulling $BRANCH"
  before=$(as_app git -C "$APP_DIR" rev-parse HEAD)
  as_app git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  as_app git -C "$APP_DIR" merge --ff-only --quiet "origin/$BRANCH" ||
    die "Local changes block the update. See: sudo -u $APP_USER git -C $APP_DIR status"
  after=$(as_app git -C "$APP_DIR" rev-parse HEAD)
  if [ "$before" = "$after" ]; then
    log "Already up to date ($(as_app git -C "$APP_DIR" log -1 --format='%h %s'))"
  else
    as_app git -C "$APP_DIR" --no-pager log --oneline "$before..$after"
  fi
fi

ensure_go
ensure_node
build_backend
build_frontend
activate_release
if ! restart_services; then
  rollback
  die "The new release failed its health check and was rolled back."
fi
log "Deployed $(as_app git -C "$APP_DIR" log -1 --format='%h %s')"
