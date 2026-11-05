# Arkadag şäher muzeýiniň saýty

arkadagshahermuzey.gov.tm: Go Fiber API (`backend/`), Next.js saýt (`frontend/`), MySQL/MariaDB.

## Lokal işletmek (Windows)

Talaplar: Go, Node.js, XAMPP MySQL/MariaDB (ýa-da başga MySQL).

```bat
run.bat
```

ýa-da PowerShell-de `.\run.ps1`. Skript:

1. MySQL-i barlaýar, öçük bolsa XAMPP-dan işledýär.
2. `backend\.env` ýok bolsa `.env.example`-den döredýär (täze JWT açary bilen).
3. Gerek bolsa `npm install` edýär.
4. API-ni ýygnap `:8085`-de, health barlagyndan soň saýty `:3005`-de işledýär we brauzeri açýar.
5. Iki serwisiň logy şol penjirede görünýär. **Ctrl+C** ikisini hem duruzýar.

| Buýruk | Näme edýär |
| --- | --- |
| `.\run.ps1` | dev režimi (hot reload) |
| `.\run.ps1 prod` | production build (`.next\standalone`), serwerdäki ýaly |
| `.\run.ps1 stop` | öňki işletmeden galan prosesleri duruzýar (penjire ýapylan bolsa) |
| `.\run.ps1 status` | näme işleýändigini görkezýär |
| `.\run.ps1 -ApiPort 8090 -WebPort 3010 -NoBrowser` | başga portlar, brauzer açmazdan |

`run.bat` hem şol argumentleri kabul edýär (`run.bat prod`, `run.bat stop`).

* Portlar `.env` faýllaryny üýtgetmezden ulanylýar: skript olary proses environment-i arkaly berýär, ol bolsa `.env`-den öňde durýar.
* Loglar we PID-ler: `.run\` (git-e girmeýär).
* Saýt: http://localhost:3005/tk, admin: http://localhost:3005/tk/admin.
* Bir `frontend` bukjasy üçin diňe bir `next dev` işläp bilýär. Başga biri işläp dursa, skript PID-ini aýdýar; ýa-da `prod` režimini ulanyň.

## Serwere goýmak

[deploy/README.md](deploy/README.md) (Docker-siz: `git pull` + `deploy.sh`).

## Resminamalar

[docs/API.md](docs/API.md), [docs/FRONTEND.md](docs/FRONTEND.md), [docs/ADMIN.md](docs/ADMIN.md).
