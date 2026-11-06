# Serwere goýmak (Docker-siz)

Saýt iki hyzmatdan ybarat: **Go API** (`museum-api`, `127.0.0.1:8080`) we **Next.js saýt** (`museum-web`, `127.0.0.1:3000`).
Daşyndan diňe **nginx** (80/443) görünýär: `/api/` → Go, `/uploads/` → göni diskden, galan hemme zat → Next.js.

Talaplar: Ubuntu 22.04/24.04, `sudo`, MySQL ýa-da MariaDB (bar bolsa şony ulanýar), SSL sertifikat.
Go we Node.js-i skriptiň özi gurýar (`/usr/local/go`, `/opt/node`).

## 1. Ilkinji gurnama (bir gezek)

```bash
cd /var/www
sudo git clone https://github.com/Esca6585dev/arkadag-muzey-web.git
cd arkadag-muzey-web
sudo bash deploy/setup.sh
```

`setup.sh` şulary edýär:

1. Ýetmeýän paketleri (`git`, `curl`, `nginx`, ...) we Go, Node.js-i gurýar.
2. `museum` atly ulgam ulanyjysyny döredýär. Hyzmatlar şol ulanyjy bilen işleýär, root bilen däl.
3. MySQL-de `arkadag_museum` bazasyny we `museum` ulanyjysyny döredýär (parol awtomatik döredilýär).
4. `backend/.env` we `frontend/.env.production.local` faýllaryny ýazýar (JWT açary, admin paroly awtomatik).
5. Backend-i we frontend-i gurýar, `museum-api` we `museum-web` systemd hyzmatlaryny işledýär.
6. Köne Joomla saýtyndan täzelikleri (surat galereýalary bilen), çäreleri, fotoalbomlary we bölüm tekstlerini import edýär (soraýar, `deploy/import.sh` arkaly).
7. nginx konfigurasiýasyny ýazýar. Köne saýtyň SSL sertifikatyny tapýar we ulanýar, ýogsa `~/fullchain.crt` + `~/private.key` faýllaryny alýar.
8. Köne saýtyň nginx konfigurasiýasyny öçürmek üçin rugsat soraýar. Faýllar pozulmaýar, diňe `/etc/nginx/disabled-by-arkadag-muzey-web/` bukjasyna geçirilýär.

Skript şu soraglary berip biler:

- **MySQL root paroly**: `sudo mysql` parolsyz girýän bolsa, soramaýar.
- **Köne Joomla mazmunyny import etmelimi?**: `y`.
- **Köne nginx konfigurasiýasyny öçürmelimi?**: `y` (täze saýt işläp başlar).

Ahyrynda admin paneliň salgysyny, e-poçtasyny we **parolyny** görkezýär. Paroly ýazyp alyň we ilkinji girişden soň üýtgediň.

Skripti gaýtadan işletmek howpsuz: bar bolan `.env`, parollar we maglumatlar saklanýar.

### Sazlamalar (gerek bolsa)

```bash
# Başga portlar (8080/3000 eýýäm eýelenen bolsa):
sudo API_PORT=8090 WEB_PORT=3010 bash deploy/setup.sh

# Sertifikatyň ýoluny el bilen görkezmek:
sudo SSL_CERT=/etc/ssl/museum/fullchain.crt SSL_KEY=/etc/ssl/museum/private.key bash deploy/setup.sh

# Köne Joomla saýty başga ýerde bolsa:
sudo LEGACY_DIR=/var/www/html bash deploy/setup.sh

# Importy soramazdan etmek / etmezlik, ähli soraglara "hawa":
sudo bash deploy/setup.sh --import --yes
sudo bash deploy/setup.sh --no-import

# Serwer internete proksi arkaly çykýan bolsa:
sudo HTTPS_PROXY=http://proxy:port HTTP_PROXY=http://proxy:port bash deploy/setup.sh
```

## Köne saýtyň maglumatlaryny import etmek (islendik wagt)

Täzelikler, çäreler, galereýa boş bolsa ýa-da köne saýt soňra täzelenen bolsa:

```bash
cd /var/www/arkadag-muzey-web
sudo bash deploy/deploy.sh          # iň täze kody al we gur
sudo bash deploy/import.sh          # köne Joomla mazmunyny göçür
```

`import.sh` şulary edýär:

- Köne saýty özi tapýar (`/var/www/museum`, `/var/www/museumweb`, `/var/www/html`), bazanyň parolyny onuň `configuration.php` faýlyndan okaýar.
- **Täzelikler**: ähli makalalar (tk, ru, en) örtük suraty we doly surat galereýasy bilen.
- **Çäreler**: sergi, gezelenç, duşuşyk, söhbetdeşlik, konsert, maslahat ýaly habarlar "Geçen çäreler" bölümine goşulýar.
- **Galereýa**: iki we ondan köp suraty bolan her habar üçin aýratyn albom.
- **Bölümler**: bäş zalyň doly tekstleri.
- Suratlary `backend/uploads/legacy/` bukjasyna göçürýär (uly suratlar 2200px çenli kiçeldilýär).

Gaýtadan işletmek howpsuz: öňki importy täzeleýär, dublikat döretmeýär.
Diňe näme import ediljekdigini görmek üçin: `sudo bash deploy/import.sh --dry-run`.

Köne saýt başga bukjada bolsa: `sudo LEGACY_DIR=/var/www/<bukja> bash deploy/import.sh`.
Köne saýt pozulan bolsa, ilki ätiýaçlykdan dikeldiň (`site_files.tar.gz` → `/var/www/museum`, `database.sql` → `museum_db` bazasy), soňra `import.sh`-y işlediň.

Bellik: köne saýtda diňe 6 eksponat bardy (olar täze saýtda eýýäm bar). Täze eksponatlary admin panelden goşup bolýar.

## 2. Täzelemek (her gezek GitHub-a täze kod iberilende)

```bash
sudo bash /var/www/arkadag-muzey-web/deploy/deploy.sh
```

Skript `git pull` edýär, backend-i we frontend-i gurýar, täze wersiýany goýup hyzmatlary täzeden işledýär we saglyk barlagyny geçirýär.
Gurnama wagtynda köne wersiýa işlemegini dowam edýär, saýt diňe 1-2 sekunt öçýär.
Täze wersiýa açylmasa, **awtomatik** öňki wersiýa gaýdyp geçýär.

```bash
sudo bash deploy/deploy.sh status     # hyzmatlaryň ýagdaýy we haýsy commit goýlandygy
sudo bash deploy/deploy.sh rollback   # öňki wersiýa gaýtmak
sudo bash deploy/deploy.sh restart    # diňe täzeden işletmek
sudo bash deploy/deploy.sh --no-pull  # pull etmän täzeden gurmak
```

### Öz kompýuteriňden bir buýruk bilen täzelemek (Windows): `deploy/remote-deploy.bat`

`%USERPROFILE%\.ssh\config` faýlynda `Host arkadagshahermuzey` bar bolsa, serwere girmän täzeläp bolýar:

```powershell
deploy\remote-deploy.bat              # serwerde: git pull (proksi bilen) + täzeden gurmak + täzeden işletmek
deploy\remote-deploy.bat -Push        # öňünden lokal main-i GitHub-a iberýär
deploy\remote-deploy.bat -Import      # köne Joomla habarlaryny/çärelerini hem täzeden göçürýär
deploy\remote-deploy.bat -Diagnose    # diňe serweriň hasabatyny görkezýär (deploy/diagnose.sh)
```

### Proksi arkaly ýa-da el bilen gurlan serwerde täzelemek: `deploy/pull.sh`

Serwer GitHub-a diňe proksi arkaly çykýan bolsa ýa-da saýt `setup.sh` bilen gurulmadyk bolsa:

```bash
cd /var/www/arkadag-muzey-web
sudo bash deploy/pull.sh                                     # pull + täzeden gurmak
sudo bash deploy/pull.sh --proxy socks5://127.0.0.1:10808    # proksi arkaly
sudo bash deploy/pull.sh --proxy http://10.0.0.5:3128 --import   # proksi + köne mazmuny import
sudo bash deploy/pull.sh --no-build                          # diňe kody almak
sudo bash deploy/pull.sh --stash                             # serwerde üýtgedilen faýllary bir gyra goýup pull etmek
```

Skript ilki GitHub-a baglanyşygy barlaýar, serwerde üýtgedilen faýllar bar bolsa durýar (`--stash` bilen olary `git stash`-a goýýar),
täze commitleri görkezýär, proksini Go/npm ýüklemelerine hem berýär, soňra saýty täzeden gurýar:
`/etc/arkadag-muzey-web.env` bar bolsa `deploy.sh` bilen, ýogsa taslama bukjasyndaky `safe-rebuild-museum.sh` bilen.
Proksini `PROXY=... sudo -E bash deploy/pull.sh` görnüşinde hem berip bolýar.

Bazany ýa-da suratlary GitHub arkaly geçirmäň (repo açyk, uly faýllar kabul edilmeýär): `*.sql` we `*.tar.gz` faýllary `.gitignore`-da;
olary `scp` bilen serwere iberiň.

## 3. Loglar we ýalňyşlyklar

```bash
journalctl -u museum-api -f      # API loglary
journalctl -u museum-web -f      # saýt loglary
tail -f /var/log/nginx/arkadagshahermuzey.gov.tm.error.log
```

- **502 Bad Gateway**: `sudo bash deploy/deploy.sh status`. Hyzmatlaryň biri işlemeýär, sebäbini `journalctl` loglaryndan görüň.
- **Gurnama wagtynda ýat ýetmezçiligi** (`JavaScript heap out of memory` ýa-da `Killed`): serwerde 2 GB-dan az RAM bolsa, swap goşuň:
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```
- **Go/Node ýüklenmeýär**: serwer `go.dev`, `nodejs.org`, `registry.npmjs.org` we `proxy.golang.org` salgylaryna çykyp bilmeli. Bolmasa, `HTTPS_PROXY` ulanyň (ýokarda görkezilişi ýaly).

## 4. Köne saýta gaýdyp geçmek (gerek bolsa)

```bash
sudo rm /etc/nginx/sites-enabled/arkadag-muzey-web.conf
cd /etc/nginx/disabled-by-arkadag-muzey-web
while read -r f; do sudo mv "$(basename "$f")" "$f"; done < RESTORE.txt
sudo nginx -t && sudo systemctl reload nginx
```

Köne saýtyň faýllary (`/var/www/museum`) we bazasy üýtgedilmeýär.

## 5. Ätiýaçlyk nusga (backup)

Täze saýtyň maglumatlary MySQL-deki `arkadag_museum` bazasynda we `backend/uploads/` bukjasynda saklanýar:

```bash
sudo mysqldump --single-transaction arkadag_museum | gzip > ~/backups/arkadag_museum-$(date +%F).sql.gz
sudo tar czf ~/backups/uploads-$(date +%F).tgz -C /var/www/arkadag-muzey-web/backend uploads
```

`~/backup-museum.sh` skriptiňize şu iki setiri goşmagyňyz ýeterlik.

## Faýllar

| Ýer | Näme |
|---|---|
| `/etc/arkadag-muzey-web.env` | domen, portlar, ulanyjy (setup.sh ýazýar) |
| `backend/.env` | API sazlamalary, DB paroly, JWT açary (diňe `museum` okap bilýär) |
| `frontend/.env.production.local` | API salgysy we saýtyň URL-i |
| `/etc/systemd/system/museum-{api,web}.service` | hyzmatlar |
| `/etc/nginx/sites-available/arkadag-muzey-web.conf` | nginx (`deploy/templates/nginx.conf` şablonyndan) |
| `backend/uploads/` | ýüklenen suratlar |
