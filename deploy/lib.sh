#!/usr/bin/env bash
# Shared helpers for deploy/setup.sh and deploy/deploy.sh. Not meant to be run directly.

CONF_FILE=/etc/arkadag-muzey-web.env
NODE_MAJOR=24
NODE_MIN=20.9.0

log()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mxx  %s\033[0m\n' "$*" >&2; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "Run as root: sudo $0 $*"
}

# version_ge A B -> true when A >= B (dotted versions)
version_ge() {
  [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

# Loads /etc/arkadag-muzey-web.env (written by setup.sh) and fills defaults.
# Variables already set in the environment win over the file.
load_conf() {
  local k v
  if [ -f "$CONF_FILE" ]; then
    while IFS='=' read -r k v; do
      case $k in
        APP_DIR | APP_USER | DOMAIN | API_PORT | WEB_PORT | BRANCH)
          [ -z "${!k:-}" ] && printf -v "$k" '%s' "$v" ;;
      esac
    done < <(grep -E '^[A-Z_]+=' "$CONF_FILE")
  fi
  APP_DIR=${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
  APP_USER=${APP_USER:-museum}
  DOMAIN=${DOMAIN:-arkadagshahermuzey.gov.tm}
  API_PORT=${API_PORT:-8080}
  WEB_PORT=${WEB_PORT:-3000}
  BRANCH=${BRANCH:-main}
}

save_conf() {
  cat >"$CONF_FILE" <<EOF
# Written by deploy/setup.sh - read by setup.sh and deploy.sh.
APP_DIR=$APP_DIR
APP_USER=$APP_USER
DOMAIN=$DOMAIN
API_PORT=$API_PORT
WEB_PORT=$WEB_PORT
BRANCH=$BRANCH
EOF
  chmod 644 "$CONF_FILE"
}

# Runs a command as the app user with the toolchains on PATH. Proxy variables are passed
# through so the build also works on servers that reach the internet through a proxy.
as_app() {
  local envs=(PATH="/usr/local/go/bin:/usr/local/bin:/usr/bin:/bin" HOME="$(getent passwd "$APP_USER" | cut -d: -f6)")
  envs+=(GOPROXY="${GOPROXY:-https://proxy.golang.org|https://goproxy.io|direct}" GOTOOLCHAIN=local)
  envs+=(NEXT_TELEMETRY_DISABLED=1)
  local v
  for v in HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy; do
    [ -n "${!v:-}" ] && envs+=("$v=${!v}")
  done
  sudo -u "$APP_USER" env "${envs[@]}" "$@"
}

arch_name() {
  case "$(uname -m)" in
    x86_64) echo amd64 ;;
    aarch64 | arm64) echo arm64 ;;
    *) die "Unsupported CPU architecture: $(uname -m)" ;;
  esac
}

# Installs the Go version required by backend/go.mod into /usr/local/go (if older/missing).
ensure_go() {
  local want have="" arch tgz
  want=$(sed -n 's/^go \([0-9][0-9.]*\).*/\1/p' "$APP_DIR/backend/go.mod")
  [[ $want =~ ^[0-9]+\.[0-9]+$ ]] && want="$want.0"
  [ -x /usr/local/go/bin/go ] && have=$(/usr/local/go/bin/go env GOVERSION | sed 's/^go//')
  if [ -n "$have" ] && version_ge "$have" "$want"; then
    log "Go $have is installed"
    return
  fi
  arch=$(arch_name)
  tgz=$(mktemp)
  log "Installing Go $want"
  curl -fL --retry 3 -o "$tgz" "https://go.dev/dl/go${want}.linux-${arch}.tar.gz" ||
    curl -fL --retry 3 -o "$tgz" "https://dl.google.com/go/go${want}.linux-${arch}.tar.gz" ||
    die "Could not download Go $want (set HTTPS_PROXY if the server needs a proxy)"
  rm -rf /usr/local/go
  tar -C /usr/local -xzf "$tgz"
  rm -f "$tgz"
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
}

# Installs the latest Node.js $NODE_MAJOR.x into /opt/node unless a new enough node exists.
ensure_node() {
  local have="" arch base file tmp
  command -v node >/dev/null 2>&1 && have=$(node -p 'process.versions.node')
  if [ -n "$have" ] && version_ge "$have" "$NODE_MIN"; then
    log "Node.js $have is installed"
    [ -x /usr/local/bin/node ] || ln -sf "$(command -v node)" /usr/local/bin/node
    return
  fi
  arch=$(arch_name)
  [ "$arch" = amd64 ] && arch=x64
  base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  tmp=$(mktemp -d)
  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL --retry 3 -o "$tmp/SHASUMS256.txt" "$base/SHASUMS256.txt" || die "Could not reach nodejs.org (set HTTPS_PROXY if needed)"
  file=$(awk '{print $2}' "$tmp/SHASUMS256.txt" | grep -E "^node-v[0-9.]+-linux-${arch}\.tar\.xz$" | head -n1)
  [ -n "$file" ] || die "No Node.js build found for linux-${arch}"
  curl -fL --retry 3 -o "$tmp/$file" "$base/$file"
  (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum -c --quiet) || die "Node.js checksum mismatch"
  rm -rf /opt/node && mkdir -p /opt/node
  tar -xJf "$tmp/$file" -C /opt/node --strip-components=1
  rm -rf "$tmp"
  ln -sf /opt/node/bin/node /usr/local/bin/node
  ln -sf /opt/node/bin/npm /usr/local/bin/npm
  ln -sf /opt/node/bin/npx /usr/local/bin/npx
}

# wait_http URL [seconds] -> true once URL answers with 2xx/3xx
wait_http() {
  local url=$1 limit=${2:-60} i
  for ((i = 0; i < limit; i++)); do
    if curl -fsS -o /dev/null --max-time 5 "$url"; then return 0; fi
    sleep 1
  done
  return 1
}

build_backend() {
  log "Building backend (Go)"
  as_app bash -c "cd '$APP_DIR/backend' && go build -trimpath -ldflags '-s -w' -o bin/server.new ./cmd/server && go build -trimpath -ldflags '-s -w' -o bin/import ./cmd/import"
}

build_frontend() {
  log "Building frontend (Next.js) - this takes a few minutes"
  as_app bash -c "cd '$APP_DIR/frontend' && npm ci --no-audit --no-fund --loglevel=error && npm run build"
  # Assemble a self-contained release next to the running one so the live site keeps
  # working during the build; the swap happens in activate_release.
  local fe=$APP_DIR/frontend
  [ -f "$fe/.next/standalone/server.js" ] || die "Standalone build missing: $fe/.next/standalone/server.js"
  as_app bash -c "cd '$fe' && rm -rf .release-new && cp -a .next/standalone .release-new && mkdir -p .release-new/.next && cp -a .next/static .release-new/.next/static && cp -a public .release-new/public"
}

# Swaps the freshly built backend binary and frontend release in, keeping the previous
# ones for `deploy.sh rollback`.
activate_release() {
  local be=$APP_DIR/backend fe=$APP_DIR/frontend
  if [ -f "$be/bin/server.new" ]; then
    [ -f "$be/bin/server" ] && as_app mv -f "$be/bin/server" "$be/bin/server.prev"
    as_app mv -f "$be/bin/server.new" "$be/bin/server"
  fi
  if [ -d "$fe/.release-new" ]; then
    as_app rm -rf "$fe/.release-prev"
    [ -d "$fe/.release" ] && as_app mv "$fe/.release" "$fe/.release-prev"
    as_app mv "$fe/.release-new" "$fe/.release"
  fi
}

restart_services() {
  log "Restarting services"
  systemctl restart museum-api
  wait_http "http://127.0.0.1:$API_PORT/api/v1/health" 60 || { journalctl -u museum-api -n 40 --no-pager; return 1; }
  systemctl restart museum-web
  wait_http "http://127.0.0.1:$WEB_PORT/tk" 60 || { journalctl -u museum-web -n 40 --no-pager; return 1; }
  log "API and website are up"
}
