#!/usr/bin/env bash
# Shows how the site runs on this server and where its content comes from, to find out why a
# page shows no data. Read-only; passwords are masked. Paste the whole output when asking for help.
#
#   sudo bash deploy/diagnose.sh
set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE=$APP_DIR/backend/.env
section() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
envval() { sed -nE "s/^$1=(.*)$/\1/p" "$2" 2>/dev/null | tail -n1; }
mask() { sed -E 's/(PASSWORD|SECRET|PASS)=.*/\1=***/'; }

section "Code"
git -C "$APP_DIR" -c safe.directory="$APP_DIR" log -1 --format='%h %s (%cr)'
git -C "$APP_DIR" -c safe.directory="$APP_DIR" status --short --untracked-files=no

section "Listening ports (web/api)"
ss -ltnpH 2>/dev/null | awk '{print $4, $6}' | grep -E ':(80|443|3000|3001|3101|8080|8085) ' || echo "none of 80/443/3000/3001/3101/8080/8085"

section "PM2 processes (every user running PM2)"
for u in $(ps -eo user=,args= | awk '/God Daemon/ {print $1}' | sort -u); do
  echo "-- PM2 of user: $u"
  sudo -u "$u" -H pm2 jlist 2>/dev/null | node -e '
    let s=""; process.stdin.on("data", d => s += d).on("end", () => {
      try {
        for (const p of JSON.parse(s)) {
          const e = p.pm2_env || {};
          console.log(`   ${p.name}  status=${e.status}  pid=${p.pid}  cwd=${e.pm_cwd}  script=${e.pm_exec_path} ${(e.args||[]).join(" ")}`);
        }
      } catch { console.log("   (could not read pm2 list)"); }
    });' 2>/dev/null || echo "   (pm2/node not available for $u)"
done
ps -eo user=,args= | grep -q 'God Daemon' || echo "no PM2 daemon running"

section "systemd services"
systemctl list-units --type=service --all --no-legend 2>/dev/null | grep -iE 'museum|arkadag|next|node|pm2' || echo "none"

section "API process"
api_port=$(envval APP_PORT "$ENV_FILE"); api_port=${api_port:-8080}
api_pid=$(ss -ltnpH "sport = :$api_port" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -n1 | cut -d= -f2)
if [ -n "$api_pid" ]; then
  echo "port $api_port -> pid $api_pid, user $(ps -o user= -p "$api_pid")"
  echo "binary:  $(readlink -f /proc/"$api_pid"/exe)"
  echo "cwd:     $(readlink -f /proc/"$api_pid"/cwd)"
  echo "started: $(ps -o lstart= -p "$api_pid")"
  echo "env DB settings of the running API (empty = taken from .env in its cwd):"
  tr '\0' '\n' </proc/"$api_pid"/environ | grep -E '^(DB_|APP_ENV|APP_PORT|UPLOAD_DIR)' | mask | sed 's/^/   /'
  api_env=$(readlink -f /proc/"$api_pid"/cwd)/.env
  if [ -f "$api_env" ] && [ "$api_env" != "$ENV_FILE" ]; then
    echo "NOTE: the API reads $api_env, not $ENV_FILE:"
    grep -E '^(DB_|APP_PORT|UPLOAD_DIR)' "$api_env" | mask | sed 's/^/   /'
  fi
else
  echo "nothing listens on API port $api_port (from $ENV_FILE)"
fi

section "backend/.env (what deploy/import.sh writes into)"
grep -E '^(APP_ENV|APP_PORT|DB_HOST|DB_PORT|DB_USER|DB_NAME|UPLOAD_DIR|UPLOAD_URL)=' "$ENV_FILE" 2>/dev/null | mask || echo "missing: $ENV_FILE"

section "Database content (backend/.env)"
db=$(envval DB_NAME "$ENV_FILE"); dbu=$(envval DB_USER "$ENV_FILE"); dbp=$(envval DB_PASSWORD "$ENV_FILE")
dbh=$(envval DB_HOST "$ENV_FILE"); dbport=$(envval DB_PORT "$ENV_FILE")
MYSQL_PWD="$dbp" mysql -h "${dbh:-127.0.0.1}" -P "${dbport:-3306}" -u "${dbu:-root}" "${db:-arkadag_museum}" -N -e "
  SELECT 'articles total / published', COUNT(*), SUM(status='published') FROM articles;
  SELECT 'articles with tk / ru / en title', SUM(JSON_UNQUOTE(JSON_EXTRACT(title,'\$.tk'))<>''), SUM(JSON_UNQUOTE(JSON_EXTRACT(title,'\$.ru'))<>''), SUM(JSON_UNQUOTE(JSON_EXTRACT(title,'\$.en'))<>'') FROM articles;
  SELECT 'events total / published', COUNT(*), SUM(status='published') FROM events;
  SELECT 'galleries / photos', (SELECT COUNT(*) FROM galleries), (SELECT COUNT(*) FROM gallery_items);
  SELECT 'newest article', id, published_at, LEFT(JSON_UNQUOTE(JSON_EXTRACT(title,'\$.tk')),60) FROM articles ORDER BY id DESC LIMIT 1;" 2>&1 | sed 's/\t/  |  /g'

section "API answers (http://127.0.0.1:$api_port)"
for q in "articles?limit=1" "events?limit=1" "events?past=true&limit=1" "galleries?limit=1"; do
  for loc in tk ru; do
    out=$(curl -s --max-time 10 -H "X-Locale: $loc" "http://127.0.0.1:$api_port/api/v1/public/$q&locale=$loc")
    printf '%-28s %s  %s\n' "$q" "$loc" "$(grep -oE '"total":[0-9]+' <<<"$out" || echo "${out:0:120}")"
  done
done

section "Website answers"
for port in 3000 3001; do
  ss -ltnH "sport = :$port" 2>/dev/null | grep -q . || continue
  for p in tk/news tk/events tk/gallery; do
    html=$(curl -s --max-time 30 "http://127.0.0.1:$port/$p")
    printf ':%s /%-12s links to items: %s\n' "$port" "$p" "$(grep -oE "href=\"/tk/${p#tk/}/[^\"]+\"" <<<"$html" | sort -u | wc -l)"
  done
done
for f in frontend/.env.production frontend/.env.production.local frontend/.env.local; do
  [ -f "$APP_DIR/$f" ] && echo "$f: $(grep -E '^(API_URL|NEXT_PUBLIC_[A-Z_]+)=' "$APP_DIR/$f" | tr '\n' ' ')"
done

section "Uploads"
upl=$(envval UPLOAD_DIR "$ENV_FILE"); upl=${upl:-./uploads}
case $upl in /*) ;; *) upl=$APP_DIR/backend/${upl#./} ;; esac
echo "$upl: $(find "$upl" -type f 2>/dev/null | wc -l) files, legacy: $(find "$upl/legacy" -type f 2>/dev/null | wc -l)"
