<#
.SYNOPSIS
  Packs the local site content (every database row and the uploaded files) into one archive
  that deploy/restore.sh loads on the server.

.DESCRIPTION
  Reads the database settings from backend\.env, dumps the rows of every table and adds
  backend\uploads. Table definitions are left out on purpose: the server's API creates its own
  tables, so a dump from local MariaDB also loads into MySQL on the server. Login sessions
  (refresh_tokens) are left out too.

.EXAMPLE
  .\deploy\export-local.ps1                             # writes museum-export-YYYYMMDD-HHMM.tar.gz
  .\deploy\export-local.ps1 -Server ubuntu@10.0.0.5     # also copies it to the server's home folder
  .\deploy\export-local.ps1 -NoUploads                  # database only
#>
param(
    [string]$Server = "",
    [string]$Out = "",
    [switch]$NoUploads
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$Root = Split-Path $PSScriptRoot -Parent
$Backend = Join-Path $Root "backend"
$Stage = Join-Path $Root ".run\export"
$XamppDir = if ($env:XAMPP_DIR) { $env:XAMPP_DIR } else { "C:\xampp" }
$Skip = @("refresh_tokens")

function Info([string]$Msg) { Write-Host "==> $Msg" -ForegroundColor Cyan }
function Die([string]$Msg) { Write-Host "XX  $Msg" -ForegroundColor Red; exit 1 }

# bash on the server reads these files: UTF-8 without BOM, LF line endings.
function Write-Lines([string]$Path, [string[]]$Lines) {
    [IO.File]::WriteAllText($Path, (($Lines -join "`n") + "`n"), (New-Object Text.UTF8Encoding $false))
}

function Find-Tool([string]$Name) {
    $p = Join-Path $XamppDir "mysql\bin\$Name.exe"
    if (Test-Path $p) { return $p }
    $c = Get-Command $Name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    Die "$Name.exe not found. Install XAMPP or set XAMPP_DIR."
}

# --- settings from backend\.env --------------------------------------------------------------
$envFile = Join-Path $Backend ".env"
if (-not (Test-Path $envFile)) { Die "backend\.env not found" }
$cfg = @{}
foreach ($line in Get-Content $envFile -Encoding UTF8) {
    if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$') { $cfg[$Matches[1]] = $Matches[2].Trim().Trim('"', "'") }
}
function Cfg([string]$Key, [string]$Default) { if ($cfg[$Key]) { $cfg[$Key] } else { $Default } }
$db = Cfg "DB_NAME" "arkadag_museum"
$uploads = Cfg "UPLOAD_DIR" "./uploads"
if (-not [IO.Path]::IsPathRooted($uploads)) { $uploads = Join-Path $Backend ($uploads -replace '^\./', '') }

$mysql = Find-Tool "mysql"
$mysqldump = Find-Tool "mysqldump"
$tar = Join-Path $env:SystemRoot "System32\tar.exe"
if (-not (Test-Path $tar)) { $tar = (Get-Command tar -ErrorAction SilentlyContinue).Source }
if (-not $tar) { Die "tar.exe not found (it ships with Windows 10 1803 and newer)" }

$conn = @("--host=$(Cfg 'DB_HOST' '127.0.0.1')", "--port=$(Cfg 'DB_PORT' '3306')", "--user=$(Cfg 'DB_USER' 'root')",
    "--protocol=TCP", "--default-character-set=utf8mb4")

if (-not $Out) { $Out = Join-Path $Root ("museum-export-{0}.tar.gz" -f (Get-Date -Format "yyyyMMdd-HHmm")) }
$Out = [IO.Path]::GetFullPath($Out)

$env:MYSQL_PWD = Cfg "DB_PASSWORD" ""
try {
    if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
    New-Item -ItemType Directory -Force $Stage | Out-Null

    # --- table list, row counts and columns (restore.sh checks the server against these) -------
    Info "Reading database $db"
    $tables = @(& $mysql @conn -N -B -e "SHOW TABLES" $db) | Where-Object { $_ -and $Skip -notcontains $_ }
    if ($LASTEXITCODE -ne 0 -or -not $tables) { Die "Could not read database $db. Is MySQL (XAMPP) running?" }

    $countSql = ($tables | ForEach-Object { "SELECT '$_', COUNT(*) FROM ``$_``" }) -join " UNION ALL "
    $manifest = @(& $mysql @conn -N -B -e $countSql $db)
    if ($LASTEXITCODE -ne 0) { Die "Could not count rows" }
    Write-Lines (Join-Path $Stage "manifest.txt") $manifest

    $columns = @(& $mysql @conn -N -B -e "SELECT CONCAT(table_name, '.', column_name) FROM information_schema.columns WHERE table_schema = '$db' ORDER BY 1" $db) |
        Where-Object { $Skip -notcontains ($_ -split '\.')[0] }
    if ($LASTEXITCODE -ne 0) { Die "Could not read columns" }
    Write-Lines (Join-Path $Stage "columns.txt") $columns

    # --- rows only. No LOCK TABLES / ALTER TABLE in the dump, so restore.sh can load it inside
    #     one transaction that rolls back completely if anything fails. -------------------------
    Info "Dumping rows"
    $ignore = $Skip | ForEach-Object { "--ignore-table=$db.$_" }
    & $mysqldump @conn --no-create-info --complete-insert --skip-add-locks --skip-disable-keys --skip-triggers `
        --hex-blob --single-transaction --skip-comments @ignore "--result-file=$(Join-Path $Stage 'db.sql')" $db
    if ($LASTEXITCODE -ne 0) { Die "mysqldump failed" }
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

# --- archive -------------------------------------------------------------------------------------
$tarArgs = @("--exclude=.gitkeep", "-czf", $Out, "-C", $Stage, "db.sql", "manifest.txt", "columns.txt")
if (-not $NoUploads) {
    if (-not (Test-Path $uploads)) { Die "Upload folder not found: $uploads" }
    $tarArgs += @("-C", (Split-Path $uploads -Parent), (Split-Path $uploads -Leaf))
    Info "Packing database and $uploads (can take a minute)"
} else {
    Info "Packing database"
}
& $tar @tarArgs
if ($LASTEXITCODE -ne 0) { Die "tar failed" }
Remove-Item $Stage -Recurse -Force

$rows = ($manifest | ForEach-Object { [int]($_ -split "`t")[1] } | Measure-Object -Sum).Sum
$size = "{0:N1} MB" -f ((Get-Item $Out).Length / 1MB)
Info "Ready: $Out ($size, $($tables.Count) tables, $rows rows)"
$name = Split-Path $Out -Leaf

if ($Server) {
    Info "Copying to ${Server}:~/"
    & scp $Out "${Server}:~/"
    if ($LASTEXITCODE -ne 0) { Die "scp failed. Copy the file by hand (WinSCP, scp)." }
} else {
    Write-Host ""
    Write-Host "Copy it to the server, e.g.:"
    Write-Host "  scp `"$Out`" ubuntu@SERVER:~/"
}
Write-Host ""
Write-Host "Then on the server:"
Write-Host "  cd /var/www/arkadag-muzey-web && sudo git -c safe.directory=`$PWD pull origin main"
Write-Host "  sudo bash deploy/restore.sh ~/$name"
