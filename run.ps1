<#
.SYNOPSIS
  Runs the museum site locally on Windows: MySQL (XAMPP), the Go API and the Next.js frontend.

.DESCRIPTION
  Starts MySQL if it is down, builds and starts the API, waits for its health check, starts the
  frontend, opens the browser and streams both logs into this window. Ctrl+C stops everything.
  Logs and PIDs are kept in .run\ so "stop" can clean up after a window that was closed.

.EXAMPLE
  .\run.ps1                          # dev mode with hot reload: API :8085, site :3005
  .\run.ps1 prod                     # production build served from .next\standalone, like on the server
  .\run.ps1 stop                     # stops processes a previous run left behind
  .\run.ps1 status                   # shows what is running
  .\run.ps1 -ApiPort 8090 -WebPort 3010 -NoBrowser
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet("dev", "prod", "stop", "status")]
    [string]$Mode = "dev",
    [int]$ApiPort = 8085,
    [int]$WebPort = 3005,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Standalone = Join-Path $Frontend ".next\standalone"
$RunDir = Join-Path $Root ".run"
$PidFile = Join-Path $RunDir "pids.json"
$XamppDir = if ($env:XAMPP_DIR) { $env:XAMPP_DIR } else { "C:\xampp" }

function Info([string]$Msg) { Write-Host "==> $Msg" -ForegroundColor Cyan }
function Warn([string]$Msg) { Write-Host "!!  $Msg" -ForegroundColor Yellow }
function Die([string]$Msg) { Write-Host "XX  $Msg" -ForegroundColor Red; exit 1 }

function Test-Port([string]$HostName, [int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

# netstat works without admin rights and in any Windows language (the state column is not matched).
# Listening sockets are the rows whose remote address is 0.0.0.0:0 or [::]:0, IPv4 and IPv6 alike.
function Get-PortOwnerId([int]$Port) {
    $line = netstat -ano | Select-String -Pattern "^\s*TCP\s+\S+:$Port\s+(0\.0\.0\.0|\[::\]):0\s+\S+\s+(\d+)\s*$" | Select-Object -First 1
    if (-not $line) { return $null }
    return [int]$line.Matches[0].Groups[2].Value
}

function Get-PortOwner([int]$Port) {
    $ownerId = Get-PortOwnerId $Port
    if (-not $ownerId) { return "another process" }
    $proc = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
    if ($proc) { return "$($proc.ProcessName) (PID $ownerId)" }
    return "PID $ownerId"
}

function Assert-PortFree([int]$Port, [string]$What) {
    if ((Test-Port "127.0.0.1" $Port) -or (Get-PortOwnerId $Port)) {
        $owner = Get-PortOwner $Port
        Die "Port $Port ($What) is already in use by $owner. Stop it or pick another port, e.g. -ApiPort / -WebPort."
    }
}

function Read-DotEnv([string]$Path) {
    $vars = @{}
    if (Test-Path $Path) {
        foreach ($line in Get-Content $Path) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
                $vars[$Matches[1]] = $Matches[2].Trim('"', "'")
            }
        }
    }
    return $vars
}

function Stop-Tree([int]$Id) {
    $ErrorActionPreference = "Continue"
    & taskkill.exe /PID $Id /T /F 2>$null | Out-Null
}

# A saved PID only counts if the process start time matches too, so a reused PID is never killed.
function Get-SavedProcess($Entry) {
    if (-not $Entry) { return $null }
    $proc = Get-Process -Id $Entry.id -ErrorAction SilentlyContinue
    if (-not $proc) { return $null }
    try {
        if ($proc.StartTime.Ticks -ne [int64]$Entry.started) { return $null }
    } catch {
        return $null
    }
    return $proc
}

function Read-PidFile {
    if (-not (Test-Path $PidFile)) { return $null }
    try { return Get-Content $PidFile -Raw | ConvertFrom-Json } catch { return $null }
}

function Save-PidFile([hashtable]$Procs) {
    $data = @{ mode = $Mode; apiPort = $ApiPort; webPort = $WebPort }
    foreach ($name in $Procs.Keys) {
        $p = $Procs[$name]
        if ($p) { $data[$name] = @{ id = $p.Id; started = $p.StartTime.Ticks } }
    }
    $data | ConvertTo-Json | Set-Content -Path $PidFile -Encoding ASCII
}

function Stop-Previous {
    $saved = Read-PidFile
    if (-not $saved) { return $false }
    $stopped = $false
    foreach ($name in "web", "api") {
        $proc = Get-SavedProcess $saved.$name
        if ($proc) {
            Info "Stopping $name from the previous run (PID $($proc.Id))"
            Stop-Tree $proc.Id
            $stopped = $true
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return $stopped
}

function Show-Status {
    $saved = Read-PidFile
    foreach ($name in "api", "web") {
        $proc = $null
        if ($saved) { $proc = Get-SavedProcess $saved.$name }
        if ($proc) { Write-Host ("{0,-4} running, PID {1}" -f $name, $proc.Id) -ForegroundColor Green }
        else { Write-Host ("{0,-4} not started by run.ps1" -f $name) -ForegroundColor DarkGray }
    }
    $apiPortNow = $ApiPort
    $webPortNow = $WebPort
    if ($saved) { $apiPortNow = $saved.apiPort; $webPortNow = $saved.webPort }
    foreach ($check in @(@("MySQL", "127.0.0.1", 3306), @("API", "127.0.0.1", $apiPortNow), @("Site", "127.0.0.1", $webPortNow))) {
        $up = Test-Port $check[1] $check[2]
        $state = if ($up) { "listening" } else { "down" }
        $color = if ($up) { "Green" } else { "DarkGray" }
        Write-Host ("{0,-5} :{1} {2}" -f $check[0], $check[2], $state) -ForegroundColor $color
    }
}

function Start-MySql([string]$DbHost, [int]$DbPort) {
    if (Test-Port $DbHost $DbPort) { Info "MySQL is up on ${DbHost}:$DbPort"; return }
    if ($DbHost -notin @("127.0.0.1", "localhost")) { Die "MySQL at ${DbHost}:$DbPort is not reachable." }

    $svc = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(mysql|mariadb)' } | Select-Object -First 1
    if ($svc) {
        Info "Starting the '$($svc.Name)' Windows service"
        try { Start-Service $svc.Name } catch { Warn "Could not start the service (it needs admin rights): $($_.Exception.Message)" }
    }
    if (-not (Test-Port $DbHost $DbPort)) {
        $mysqld = Join-Path $XamppDir "mysql\bin\mysqld.exe"
        $ini = Join-Path $XamppDir "mysql\bin\my.ini"
        if (-not (Test-Path $mysqld)) { Die "MySQL is not running and $mysqld was not found. Start MySQL from the XAMPP control panel (or set XAMPP_DIR)." }
        Info "Starting XAMPP MySQL in the background"
        Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=`"$ini`"", "--standalone" -WorkingDirectory $XamppDir -WindowStyle Hidden | Out-Null
    }
    for ($i = 0; $i -lt 60; $i++) {
        if (Test-Port $DbHost $DbPort) { Info "MySQL is up on ${DbHost}:$DbPort"; return }
        Start-Sleep -Milliseconds 500
    }
    Die "MySQL did not come up on ${DbHost}:$DbPort within 30 seconds. Check the XAMPP control panel."
}

# next dev refuses a second dev server per folder, but only after printing "Ready", so check its lock first.
function Assert-NoOtherDevServer {
    $lock = Join-Path $Frontend ".next\dev\lock"
    if (-not (Test-Path $lock)) { return }
    # The running server keeps the lock open, so Get-Content cannot read it.
    try { $info = Read-SharedText $lock | ConvertFrom-Json } catch { return }
    if ($info.pid -and (Get-Process -Id $info.pid -ErrorAction SilentlyContinue)) {
        Die "Another next dev server already runs for this folder: $($info.appUrl) (PID $($info.pid)). Stop it with 'taskkill /PID $($info.pid) /T /F', or use 'run.ps1 prod'."
    }
}

function New-RandomHex([int]$Bytes) {
    $buf = New-Object byte[] $Bytes
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buf)
    $rng.Dispose()
    return -join ($buf | ForEach-Object { $_.ToString("x2") })
}

function Initialize-BackendEnv {
    $envPath = Join-Path $Backend ".env"
    if (Test-Path $envPath) { return }
    Info "Creating backend\.env from .env.example (with a fresh JWT secret)"
    $text = Get-Content (Join-Path $Backend ".env.example") -Raw
    $text = $text -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$(New-RandomHex 32)"
    $text = $text -replace '(?m)^APP_PORT=.*$', "APP_PORT=$ApiPort"
    # godotenv cannot read a BOM, so write plain UTF-8.
    [IO.File]::WriteAllText($envPath, $text, (New-Object Text.UTF8Encoding $false))
}

function Install-FrontendDeps {
    $lock = Join-Path $Frontend "package-lock.json"
    $stamp = Join-Path $Frontend "node_modules\.package-lock.json"
    if ((Test-Path $stamp) -and (Get-Item $stamp).LastWriteTime -ge (Get-Item $lock).LastWriteTime) { return }
    Info "Installing frontend packages (npm install)"
    Push-Location $Frontend
    try {
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { Die "npm install failed." }
    } finally {
        Pop-Location
    }
}

# Built into .run\ rather than bin\server.exe: Windows cannot overwrite an exe that is running,
# and bin\server.exe may be running outside this script.
function Build-Api {
    Info "Building the API (go build)"
    Push-Location $Backend
    try {
        & go build -o (Join-Path $RunDir "api.exe") .\cmd\server
        if ($LASTEXITCODE -ne 0) { Die "go build failed." }
    } finally {
        Pop-Location
    }
}

function Build-Web {
    Info "Building the frontend (next build), this takes a minute"
    Push-Location $Frontend
    try {
        & node node_modules\next\dist\bin\next build
        if ($LASTEXITCODE -ne 0) { Die "next build failed." }
    } finally {
        Pop-Location
    }
    # Same layout deploy/lib.sh produces: the standalone server needs static assets and public\ beside it.
    if (-not (Test-Path (Join-Path $Standalone "server.js"))) { Die "Standalone build missing: $Standalone\server.js" }
    $static = Join-Path $Standalone ".next\static"
    $public = Join-Path $Standalone "public"
    foreach ($dir in $static, $public) { if (Test-Path $dir) { Remove-Item $dir -Recurse -Force } }
    Copy-Item (Join-Path $Frontend ".next\static") $static -Recurse
    Copy-Item (Join-Path $Frontend "public") $public -Recurse
}

function Start-Logged([string]$Name, [string]$File, [string[]]$ArgList, [string]$Dir) {
    $opts = @{
        FilePath               = $File
        WorkingDirectory       = $Dir
        NoNewWindow            = $true
        PassThru               = $true
        RedirectStandardOutput = (Join-Path $RunDir "$Name.log")
        RedirectStandardError  = (Join-Path $RunDir "$Name.err.log")
    }
    if ($ArgList) { $opts.ArgumentList = $ArgList }
    return Start-Process @opts
}

function New-Tail([string]$Path, [string]$Prefix, [string]$Color) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::Read, [IO.FileShare]"ReadWrite, Delete")
    return [pscustomobject]@{
        Reader  = New-Object IO.StreamReader($stream, [Text.Encoding]::UTF8)
        Prefix  = $Prefix
        Color   = $Color
        Pending = ""
    }
}

function Read-Tail($Tail) {
    $chunk = $Tail.Reader.ReadToEnd()
    if (-not $chunk) { return }
    $lines = ($Tail.Pending + $chunk) -split "`r?`n"
    $Tail.Pending = $lines[-1]
    for ($i = 0; $i -lt $lines.Count - 1; $i++) {
        Write-Host "$($Tail.Prefix) " -ForegroundColor $Tail.Color -NoNewline
        Write-Host $lines[$i]
    }
}

function Read-Tails($Tails) { foreach ($t in $Tails) { Read-Tail $t } }

function Add-Tails([string]$Name, [string]$Color) {
    $script:Tails += New-Tail (Join-Path $RunDir "$Name.log") "[$Name]" $Color
    $script:Tails += New-Tail (Join-Path $RunDir "$Name.err.log") "[$Name]" $Color
}

function Wait-Ready([string]$What, $Proc, [scriptblock]$Probe, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        Read-Tails $script:Tails
        if ($Proc.HasExited) { Read-Tails $script:Tails; Die "$What exited during startup, see the log above (.run\)." }
        if (& $Probe) { return }
        Start-Sleep -Milliseconds 500
    }
    Die "$What did not become ready within $Seconds seconds."
}

function Test-ApiHealth {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$ApiPort/api/v1/health" -UseBasicParsing -TimeoutSec 3
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Read-SharedText([string]$Path) {
    $stream = [IO.File]::Open($Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::Read, [IO.FileShare]"ReadWrite, Delete")
    try { return (New-Object IO.StreamReader($stream)).ReadToEnd() } finally { $stream.Dispose() }
}

# A health answer alone could come from an API started elsewhere on the same port, so it only
# counts once this process has logged that it is listening (and owns the port, where netstat shows it).
function Test-ApiReady($Proc) {
    if (-not (Read-SharedText (Join-Path $RunDir "api.err.log")).Contains("API listening")) { return $false }
    if (-not (Test-ApiHealth)) { return $false }
    $owner = Get-PortOwnerId $ApiPort
    return (-not $owner) -or ($owner -eq $Proc.Id)
}

# --- main -------------------------------------------------------------------------------------

if (-not (Test-Path $RunDir)) { New-Item -ItemType Directory -Path $RunDir | Out-Null }

if ($Mode -eq "status") { Show-Status; exit 0 }
if ($Mode -eq "stop") {
    if (-not (Stop-Previous)) { Info "Nothing from a previous run is running." }
    exit 0
}

foreach ($tool in "go", "node", "npm") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Die "'$tool' was not found in PATH." }
}

if (Stop-Previous) { Start-Sleep -Seconds 1 }
Assert-PortFree $ApiPort "API"
Assert-PortFree $WebPort "site"
if ($Mode -eq "dev") { Assert-NoOtherDevServer }

Initialize-BackendEnv
$dotenv = Read-DotEnv (Join-Path $Backend ".env")
$dbHost = if ($dotenv.DB_HOST) { $dotenv.DB_HOST } else { "127.0.0.1" }
$dbPort = if ($dotenv.DB_PORT) { [int]$dotenv.DB_PORT } else { 3306 }
Start-MySql $dbHost $dbPort

# Process environment wins over the .env files in both Go (godotenv) and Next.js,
# so the ports chosen here apply without editing backend\.env or frontend\.env.local.
$siteUrl = "http://localhost:$WebPort"
$env:APP_PORT = "$ApiPort"
$env:APP_URL = "http://localhost:$ApiPort"
$env:FRONTEND_URL = $siteUrl
$env:CORS_ORIGINS = "$siteUrl,http://127.0.0.1:$WebPort"
$env:API_URL = "http://127.0.0.1:$ApiPort"
$env:NEXT_PUBLIC_SITE_URL = $siteUrl
$env:NEXT_TELEMETRY_DISABLED = "1"

Install-FrontendDeps
Build-Api

$node = (Get-Command node).Source
$script:Tails = @()
$api = $null
$web = $null
$exitCode = 0
try {
    Info "Starting the API on :$ApiPort"
    $api = Start-Logged "api" (Join-Path $RunDir "api.exe") @() $Backend
    Save-PidFile @{ api = $api }
    Add-Tails "api" "Magenta"
    Wait-Ready "The API" $api { Test-ApiReady $api } 60
    # The "listening" line is logged just before the bind, and a failed bind exits at once.
    Start-Sleep -Seconds 1
    Read-Tails $script:Tails
    if ($api.HasExited) { Die "The API stopped right after starting, see the log above (.run\)." }
    Info "API is healthy: http://127.0.0.1:$ApiPort/api/v1/health"

    if ($Mode -eq "prod") {
        # Built after the API is up because pages may fetch content while prerendering.
        Build-Web
        $env:PORT = "$WebPort"
        $env:HOSTNAME = "127.0.0.1"
        Info "Starting the production site on :$WebPort"
        $web = Start-Logged "web" $node @("server.js") $Standalone
    } else {
        Info "Starting the dev site on :$WebPort"
        $web = Start-Logged "web" $node @("node_modules\next\dist\bin\next", "dev", "-p", "$WebPort") $Frontend
    }
    Save-PidFile @{ api = $api; web = $web }
    Add-Tails "web" "Green"
    Wait-Ready "The site" $web { Test-Port "127.0.0.1" $WebPort } 120

    Write-Host ""
    Write-Host "  Site:   $siteUrl/tk" -ForegroundColor White
    Write-Host "  Admin:  $siteUrl/tk/admin" -ForegroundColor White
    Write-Host "  API:    http://127.0.0.1:$ApiPort/api/v1" -ForegroundColor White
    Write-Host "  Logs:   $RunDir" -ForegroundColor DarkGray
    Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor DarkGray
    Write-Host ""
    if (-not $NoBrowser) { Start-Process "$siteUrl/tk" }

    while ($true) {
        Read-Tails $script:Tails
        # A non-zero exit code keeps the run.bat window open so the error can be read.
        if ($api.HasExited) { Read-Tails $script:Tails; Warn "The API stopped."; $exitCode = 1; break }
        if ($web.HasExited) { Read-Tails $script:Tails; Warn "The site stopped."; $exitCode = 1; break }
        Start-Sleep -Milliseconds 300
    }
} finally {
    # Runs on Ctrl+C as well.
    foreach ($p in $web, $api) {
        if ($p -and -not $p.HasExited) { Stop-Tree $p.Id }
    }
    foreach ($t in $script:Tails) { $t.Reader.Dispose() }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Info "Stopped."
}
exit $exitCode
