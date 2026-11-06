<#
.SYNOPSIS
  Updates the live server from this PC in one step.

.DESCRIPTION
  Makes sure local main is on GitHub (pushes it with -Push), then over SSH pulls the latest
  code on the server through the server's proxy and runs deploy/pull.sh there, which rebuilds
  the site, checks it and restarts it (or rolls back on failure).
  Uses the SSH host alias from %USERPROFILE%\.ssh\config.

.EXAMPLE
  .\deploy\remote-deploy.ps1                 # pull + rebuild on the server
  .\deploy\remote-deploy.ps1 -Push           # push local main to GitHub first
  .\deploy\remote-deploy.ps1 -Import         # also re-import the old Joomla news, events, albums
  .\deploy\remote-deploy.ps1 -Diagnose       # only print the server report (deploy/diagnose.sh)
#>
param(
    [string]$Server = "arkadagshahermuzey",
    [string]$Proxy = "socks5://127.0.0.1:10808",
    [string]$AppDir = "/var/www/arkadag-muzey-web",
    [switch]$Push,
    [switch]$Import,
    [switch]$Diagnose
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$Root = Split-Path $PSScriptRoot -Parent

function Info([string]$Msg) { Write-Host "==> $Msg" -ForegroundColor Cyan }
function Die([string]$Msg) { Write-Host "XX  $Msg" -ForegroundColor Red; exit 1 }

# Local git may be configured with a proxy that is not always running; retry without it.
function Git-Net([string[]]$GitArgs) {
    & git -C $Root @GitArgs 2>$null
    if ($LASTEXITCODE -eq 0) { return }
    & git -C $Root -c http.proxy= -c https.proxy= @GitArgs
    if ($LASTEXITCODE -ne 0) { Die "git $($GitArgs -join ' ') failed." }
}

if (-not $Diagnose) {
    Info "Checking that local main is on GitHub"
    Git-Net @("fetch", "-q", "origin", "main")
    $branch = (& git -C $Root rev-parse --abbrev-ref HEAD).Trim()
    $ahead = [int](& git -C $Root rev-list --count origin/main..HEAD)
    $behind = [int](& git -C $Root rev-list --count HEAD..origin/main)
    $dirty = & git -C $Root status --porcelain --untracked-files=no
    if ($dirty) { Write-Host "!!  Uncommitted local changes are NOT deployed:" -ForegroundColor Yellow; $dirty | ForEach-Object { Write-Host "    $_" } }
    if ($branch -ne "main") { Die "You are on branch '$branch'. The server deploys main." }
    if ($ahead -gt 0) {
        if ($Push) {
            Info "Pushing $ahead local commit(s) to GitHub"
            Git-Net @("push", "-q", "origin", "main")
        } else {
            Die "$ahead local commit(s) are not on GitHub yet. Run again with -Push (or: git push origin main)."
        }
    }
    if ($behind -gt 0) { Write-Host "!!  GitHub has $behind commit(s) you have not pulled locally; the server gets them too." -ForegroundColor Yellow }
}

$proxyGit = ""
$pullFlags = ""
if ($Proxy) {
    $proxyGit = "-c http.proxy=$Proxy -c https.proxy=$Proxy"
    $pullFlags = "--proxy $Proxy"
}
if ($Import) { $pullFlags = "$pullFlags --import" }

if ($Diagnose) {
    $remote = "cd $AppDir && sudo bash deploy/diagnose.sh"
} else {
    # The first pull brings the newest deploy scripts; pull.sh then rebuilds and restarts the site.
    $remote = "cd $AppDir && sudo git -c safe.directory=$AppDir $proxyGit pull --ff-only -q origin main && sudo bash deploy/pull.sh $pullFlags"
}

Info "Running on ${Server}: $remote"
& ssh $Server $remote
if ($LASTEXITCODE -ne 0) { Die "The server step failed (exit $LASTEXITCODE). See the output above." }
Info "Done."
