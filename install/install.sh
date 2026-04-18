#!/usr/bin/env bash
# lean-statusline installer — macOS, Linux, Git Bash, WSL, MSYS2, Cygwin.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/install/install.sh | bash
#
# Or, from a local clone:
#   ./install/install.sh
#
# Flags:
#   --dir <path>   override install dir (default: $HOME/.claude)
#   --no-patch     skip patching settings.json
#   --uninstall    remove the script and the statusLine entry
#   --force        overwrite existing script without prompt

set -euo pipefail

# ── Config ──────────────────────────────────────────────
RAW_URL="${LEAN_STATUSLINE_RAW_URL:-https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/src/lean-statusline.sh}"
TARGET_DIR="${LEAN_STATUSLINE_DIR:-$HOME/.claude}"
SCRIPT_NAME="lean-statusline.sh"
SETTINGS_FILE="$TARGET_DIR/settings.json"
FORCE=0 ; PATCH=1 ; UNINSTALL=0

# ── Parse args ──────────────────────────────────────────
while [ $# -gt 0 ]; do
    case "$1" in
        --dir)        TARGET_DIR="$2"; SETTINGS_FILE="$TARGET_DIR/settings.json"; shift 2 ;;
        --no-patch)   PATCH=0; shift ;;
        --uninstall)  UNINSTALL=1; shift ;;
        --force)      FORCE=1; shift ;;
        -h|--help)    sed -n '2,18p' "$0"; exit 0 ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

# ── Colors / logger ─────────────────────────────────────
if [ -t 1 ]; then
    C_G='\033[32m'; C_Y='\033[33m'; C_R='\033[31m'; C_D='\033[2m'; C_0='\033[0m'
else
    C_G=''; C_Y=''; C_R=''; C_D=''; C_0=''
fi
say()  { printf "%b==>%b %s\n" "$C_G" "$C_0" "$*"; }
warn() { printf "%b!!%b %s\n"  "$C_Y" "$C_0" "$*" >&2; }
die()  { printf "%bxx%b %s\n"  "$C_R" "$C_0" "$*" >&2; exit 1; }

# ── Dependency check ────────────────────────────────────
for tool in jq curl; do
    command -v "$tool" >/dev/null 2>&1 || die "required tool missing: $tool

Install hints:
  macOS:         brew install $tool
  Debian/Ubuntu: sudo apt install $tool
  Fedora:        sudo dnf install $tool
  Arch:          sudo pacman -S $tool
  Git Bash (Windows): install via scoop (scoop install $tool) or choco (choco install $tool)"
done

# ── Uninstall path ──────────────────────────────────────
if [ "$UNINSTALL" = "1" ]; then
    target="$TARGET_DIR/$SCRIPT_NAME"
    [ -f "$target" ] && { rm -f "$target"; say "removed $target"; } || warn "not found: $target"
    if [ "$PATCH" = "1" ] && [ -f "$SETTINGS_FILE" ]; then
        cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak.$(date +%s)"
        tmp=$(mktemp)
        jq 'del(.statusLine)' "$SETTINGS_FILE" > "$tmp" && mv "$tmp" "$SETTINGS_FILE"
        say "removed statusLine from $SETTINGS_FILE (backup saved)"
    fi
    exit 0
fi

# ── Platform hint (for the reader, not a branch) ────────
case "$(uname -s 2>/dev/null || echo unknown)" in
    Darwin*) platform="macOS" ;;
    Linux*)  platform="Linux" ;;
    MINGW*|MSYS*|CYGWIN*) platform="Windows (POSIX)" ;;
    *) platform="unknown" ;;
esac
say "installing to $TARGET_DIR ($platform)"

# ── Ensure target dir ───────────────────────────────────
mkdir -p "$TARGET_DIR"
target="$TARGET_DIR/$SCRIPT_NAME"

# ── Fetch script (local-first, network fallback) ────────
here="$(cd "$(dirname "$0")" && pwd)"
local_src="$here/../src/$SCRIPT_NAME"

if [ -f "$target" ] && [ "$FORCE" != "1" ]; then
    warn "$target already exists — use --force to overwrite (keeping existing)"
else
    if [ -f "$local_src" ]; then
        cp "$local_src" "$target"
        say "copied from $local_src"
    else
        say "downloading from $RAW_URL"
        curl -fsSL "$RAW_URL" -o "$target" || die "download failed"
    fi
fi

# Make it executable — this is the step most home-cooked installers forget.
chmod +x "$target"
say "chmod +x $target"

# ── Patch settings.json ─────────────────────────────────
if [ "$PATCH" = "1" ]; then
    if [ ! -f "$SETTINGS_FILE" ]; then
        say "creating $SETTINGS_FILE"
        echo '{}' > "$SETTINGS_FILE"
    else
        cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak.$(date +%s)"
    fi
    tmp=$(mktemp)
    # Cross-platform command form — bash + literal path, works on Git Bash / WSL.
    jq --arg cmd "bash \"$target\"" \
       '.statusLine = {type: "command", command: $cmd}' \
       "$SETTINGS_FILE" > "$tmp" && mv "$tmp" "$SETTINGS_FILE"
    say "patched $SETTINGS_FILE (backup saved)"
else
    warn "skipped settings.json patch (--no-patch). Add manually:"
    printf '%b{ "statusLine": { "type": "command", "command": "bash \\"%s\\"" } }%b\n' "$C_D" "$target" "$C_0"
fi

# ── Smoke test ──────────────────────────────────────────
if printf '{}' | bash "$target" >/dev/null 2>&1; then
    say "smoke test passed"
else
    warn "smoke test returned non-zero — check \`bash $target < /dev/null\`"
fi

say "done. restart Claude Code to see the new statusline."
