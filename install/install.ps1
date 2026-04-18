<#
.SYNOPSIS
  lean-statusline installer for native Windows PowerShell (5.1+/7+).

.DESCRIPTION
  Downloads lean-statusline.sh into %USERPROFILE%\.claude, patches
  settings.json to wire it in as the statusLine command, and runs a
  smoke test. Bash is required at runtime — Claude Code on Windows
  already assumes Git Bash or WSL is on PATH.

.PARAMETER Dir
  Install directory. Defaults to $HOME\.claude.

.PARAMETER NoPatch
  Skip writing .statusLine into settings.json.

.PARAMETER Uninstall
  Remove the script and the statusLine entry.

.PARAMETER Force
  Overwrite an existing script without prompting.

.EXAMPLE
  iwr -useb https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/install/install.ps1 | iex

.EXAMPLE
  .\install.ps1 -Force
#>

[CmdletBinding()]
param(
    [string]$Dir,
    [switch]$NoPatch,
    [switch]$Uninstall,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$RawUrl    = if ($env:LEAN_STATUSLINE_RAW_URL) { $env:LEAN_STATUSLINE_RAW_URL } else { 'https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/src/lean-statusline.sh' }
$TargetDir = if ($Dir) { $Dir } elseif ($env:LEAN_STATUSLINE_DIR) { $env:LEAN_STATUSLINE_DIR } else { Join-Path $HOME '.claude' }
$Script    = Join-Path $TargetDir 'lean-statusline.sh'
$Settings  = Join-Path $TargetDir 'settings.json'

function Info ($m) { Write-Host "==> $m" -ForegroundColor Green }
function Warn ($m) { Write-Host "!!  $m" -ForegroundColor Yellow }
function Die  ($m) { Write-Host "xx  $m" -ForegroundColor Red; exit 1 }

# ── Pick a bash runtime that Claude Code can invoke ─────
$bashCmd = $null
foreach ($candidate in @('bash.exe','bash')) {
    $c = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($c) { $bashCmd = $c.Source; break }
}
if (-not $bashCmd) {
    Die "bash not found on PATH. Install Git for Windows (https://git-scm.com/download/win) or enable WSL, then rerun."
}

# ── Uninstall ──────────────────────────────────────────
if ($Uninstall) {
    if (Test-Path $Script) { Remove-Item $Script -Force; Info "removed $Script" } else { Warn "not found: $Script" }
    if (-not $NoPatch -and (Test-Path $Settings)) {
        Copy-Item $Settings "$Settings.bak.$([int](Get-Date -UFormat %s))"
        $j = Get-Content $Settings -Raw | ConvertFrom-Json
        if ($j.PSObject.Properties.Name -contains 'statusLine') {
            $j.PSObject.Properties.Remove('statusLine')
            $j | ConvertTo-Json -Depth 32 | Set-Content $Settings -Encoding UTF8
            Info "removed statusLine from $Settings"
        }
    }
    return
}

# ── Ensure jq (required at runtime) ────────────────────
if (-not (Get-Command jq -ErrorAction SilentlyContinue)) {
    Warn "jq not on PATH. The statusline needs it at runtime."
    Warn "  winget install jqlang.jq   # or   scoop install jq   # or   choco install jq"
}

# ── Install ────────────────────────────────────────────
Info "installing to $TargetDir"
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

$localSrc = Join-Path (Split-Path $PSScriptRoot -Parent) 'src\lean-statusline.sh'
if ((Test-Path $Script) -and -not $Force) {
    Warn "$Script already exists — pass -Force to overwrite"
} else {
    if (Test-Path $localSrc) {
        Copy-Item $localSrc $Script -Force
        Info "copied from $localSrc"
    } else {
        Info "downloading from $RawUrl"
        Invoke-WebRequest -UseBasicParsing -Uri $RawUrl -OutFile $Script
    }
    # Normalize line endings — CRLF would break the shebang.
    $text = Get-Content $Script -Raw
    Set-Content -Path $Script -Value ($text -replace "`r`n","`n") -NoNewline -Encoding UTF8
    Info "normalized LF line endings"
}

# ── Patch settings.json ────────────────────────────────
if (-not $NoPatch) {
    if (-not (Test-Path $Settings)) {
        '{}' | Set-Content $Settings -Encoding UTF8
        Info "created $Settings"
    } else {
        Copy-Item $Settings "$Settings.bak.$([int](Get-Date -UFormat %s))"
    }

    # Build the command string Claude Code will execute.
    # Single-quote the script path so embedded spaces don't break the shell.
    $bashPath = ($Script -replace '\\','/')
    $cmd      = "bash '$bashPath'"

    $j = Get-Content $Settings -Raw | ConvertFrom-Json
    if (-not $j) { $j = [pscustomobject]@{} }
    $sl = [pscustomobject]@{ type = 'command'; command = $cmd }
    if ($j.PSObject.Properties.Name -contains 'statusLine') {
        $j.statusLine = $sl
    } else {
        $j | Add-Member -NotePropertyName statusLine -NotePropertyValue $sl -Force
    }
    $j | ConvertTo-Json -Depth 32 | Set-Content $Settings -Encoding UTF8
    Info "patched $Settings (backup saved)"
} else {
    Warn "skipped settings.json patch (-NoPatch)"
}

# ── Smoke test ─────────────────────────────────────────
try {
    $out = '{}' | & $bashCmd $Script 2>$null
    Info "smoke test passed"
} catch {
    Warn "smoke test failed: $_"
}

Info "done. restart Claude Code to see the new statusline."
