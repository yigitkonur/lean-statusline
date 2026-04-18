#!/usr/bin/env bash
# lean-statusline — one-line Claude Code statusline
#   model · ctx% · dir (branch)* · 5h XX% · 7d XX%
#
# Env overrides (all opt-in):
#   LEAN_STATUSLINE_ASCII=1        force ASCII icons
#   LEAN_STATUSLINE_NO_COLOR=1     disable colors (NO_COLOR also honored)
#   LEAN_STATUSLINE_SHOW_SESSION=1 append session elapsed
#   LEAN_STATUSLINE_SHOW_EFFORT=1  append effort indicator
#
# Dependencies: bash 3.2+, jq, curl (for rate-limit fallback), date.

set -f
input=$(cat)
[ -z "$input" ] && { printf "Claude"; exit 0; }

# ── Colors ──────────────────────────────────────────────
if [ -n "${LEAN_STATUSLINE_NO_COLOR:-}" ] || [ -n "${NO_COLOR:-}" ]; then
    blue='' orange='' green='' cyan='' red='' yellow='' white='' dim='' reset='' clr=''
else
    blue='\033[38;2;0;153;255m'
    orange='\033[38;2;255;176;85m'
    green='\033[38;2;0;175;80m'
    cyan='\033[38;2;86;182;194m'
    red='\033[38;2;255;85;85m'
    yellow='\033[38;2;230;200;0m'
    white='\033[38;2;220;220;220m'
    dim='\033[2m'
    reset='\033[0m'
    clr='\033[K'
fi
sep=" ${dim}·${reset} "

# ── Icon fallback ───────────────────────────────────────
# Modern terminals render the unicode glyphs; fall back to ASCII on SSH or
# unknown TERM_PROGRAM (conservative default — opt out explicitly if needed).
use_ascii=false
if [ -n "${LEAN_STATUSLINE_ASCII:-}" ]; then
    use_ascii=true
elif [ -n "${SSH_TTY:-}" ] || [ -n "${SSH_CONNECTION:-}" ]; then
    use_ascii=true
else
    case "${TERM_PROGRAM:-}" in
        ghostty|iTerm.app|WezTerm|WarpTerminal|vscode|Apple_Terminal|Hyper|Tabby|rio) : ;;
        *) use_ascii=true ;;
    esac
fi
if $use_ascii; then
    ic_ctx="%" ; ic_timer="t" ; ic_zap="!"
else
    ic_ctx="✎" ; ic_timer="⏱" ; ic_zap="⚡"
fi

# ── Helpers ─────────────────────────────────────────────
color_for_pct() {
    local p=$1
    if   [ "$p" -ge 90 ] 2>/dev/null; then printf "$red"
    elif [ "$p" -ge 70 ] 2>/dev/null; then printf "$yellow"
    elif [ "$p" -ge 50 ] 2>/dev/null; then printf "$orange"
    else printf "$green"
    fi
}

iso_to_epoch() {
    local s="$1" e
    e=$(date -d "$s" +%s 2>/dev/null) && { echo "$e"; return; }
    local stripped="${s%%.*}"; stripped="${stripped%%Z}"; stripped="${stripped%%+*}"
    if [[ "$s" == *Z* ]] || [[ "$s" == *+00:00* ]]; then
        e=$(env TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "$stripped" +%s 2>/dev/null) \
            || e=$(env TZ=UTC date -d "${stripped/T/ }" +%s 2>/dev/null)
    else
        e=$(date -j -f "%Y-%m-%dT%H:%M:%S" "$stripped" +%s 2>/dev/null) \
            || e=$(date -d "${stripped/T/ }" +%s 2>/dev/null)
    fi
    [ -n "$e" ] && echo "$e"
}

# ── Parse JSON ──────────────────────────────────────────
model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
[ "$size" -eq 0 ] 2>/dev/null && size=200000
it=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
cc=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
cr=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')
used=$(( it + cc + cr ))
ctx_pct=$(( used * 100 / (size > 0 ? size : 200000) ))
[ "$ctx_pct" -gt 100 ] && ctx_pct=100

cwd=$(echo "$input" | jq -r '.cwd // empty'); [ -z "$cwd" ] && cwd=$(pwd)
dir=$(basename "$cwd")

# Git branch + dirty marker (fast: --no-optional-locks, porcelain)
branch="" ; dirty=""
if git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null)
    [ -n "$(git -C "$cwd" --no-optional-locks status --porcelain 2>/dev/null | head -c1)" ] && dirty="*"
fi

# Dangerously-skip-permissions indicator
zap=""
parent_cmd=$(ps -o args= -p "$PPID" 2>/dev/null)
[[ "$parent_cmd" == *"--dangerously-skip-permissions"* ]] && zap="${red}${ic_zap}${reset} "

# ── Rate limits (prefer stdin, fall back to cached API) ─
five_pct="" ; seven_pct=""
sp=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
if [ -n "$sp" ]; then
    five_pct=$(printf "%.0f" "$sp")
    seven_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' | awk 'NF{printf "%.0f",$1}')
else
    cache="/tmp/lean-statusline-usage.json"
    mkdir -p /tmp 2>/dev/null
    fresh=false
    if [ -f "$cache" ]; then
        mt=$(stat -c %Y "$cache" 2>/dev/null || stat -f %m "$cache" 2>/dev/null)
        now=$(date +%s)
        [ $((now - mt)) -lt 60 ] && fresh=true
    fi
    if ! $fresh; then
        token="${CLAUDE_CODE_OAUTH_TOKEN:-}"
        if [ -z "$token" ] && command -v security >/dev/null 2>&1; then
            blob=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
            [ -n "$blob" ] && token=$(echo "$blob" | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)
        fi
        if [ -z "$token" ] && [ -f "$HOME/.claude/.credentials.json" ]; then
            token=$(jq -r '.claudeAiOauth.accessToken // empty' "$HOME/.claude/.credentials.json" 2>/dev/null)
        fi
        if [ -z "$token" ] && command -v secret-tool >/dev/null 2>&1; then
            blob=$(timeout 2 secret-tool lookup service "Claude Code-credentials" 2>/dev/null)
            [ -n "$blob" ] && token=$(echo "$blob" | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)
        fi
        if [ -n "$token" ] && [ "$token" != "null" ]; then
            resp=$(curl -s --max-time 5 \
                -H "Accept: application/json" \
                -H "Authorization: Bearer $token" \
                -H "anthropic-beta: oauth-2025-04-20" \
                -H "User-Agent: lean-statusline" \
                "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)
            echo "$resp" | jq -e '.five_hour' >/dev/null 2>&1 && echo "$resp" > "$cache"
        fi
    fi
    if [ -f "$cache" ]; then
        data=$(cat "$cache" 2>/dev/null)
        if echo "$data" | jq -e . >/dev/null 2>&1; then
            five_pct=$(echo "$data" | jq -r '.five_hour.utilization // empty' | awk 'NF{printf "%.0f",$1}')
            seven_pct=$(echo "$data" | jq -r '.seven_day.utilization // empty' | awk 'NF{printf "%.0f",$1}')
        fi
    fi
fi

# ── Optional segments ───────────────────────────────────
session_seg=""
if [ -n "${LEAN_STATUSLINE_SHOW_SESSION:-}" ]; then
    st=$(echo "$input" | jq -r '.session.start_time // empty')
    if [ -n "$st" ] && [ "$st" != "null" ]; then
        se=$(iso_to_epoch "$st")
        if [ -n "$se" ]; then
            el=$(( $(date +%s) - se ))
            if   [ "$el" -ge 3600 ]; then dur="$((el/3600))h$(((el%3600)/60))m"
            elif [ "$el" -ge 60   ]; then dur="$((el/60))m"
            else dur="${el}s"
            fi
            session_seg="${sep}${dim}${ic_timer} ${reset}${white}${dur}${reset}"
        fi
    fi
fi

effort_seg=""
if [ -n "${LEAN_STATUSLINE_SHOW_EFFORT:-}" ]; then
    ef="default"
    [ -f "$HOME/.claude/settings.json" ] && ef=$(jq -r '.effortLevel // "default"' "$HOME/.claude/settings.json" 2>/dev/null)
    effort_seg="${sep}${dim}${ef}${reset}"
fi

# ── Assemble ────────────────────────────────────────────
pct_col=$(color_for_pct "$ctx_pct")
out="${blue}${model}${reset}${sep}${dim}${ic_ctx} ${reset}${pct_col}${ctx_pct}%${reset}${sep}${zap}${cyan}${dir}${reset}"
if [ -n "$branch" ]; then
    out+=" ${green}(${branch}${red}${dirty}${green})${reset}"
fi
if [ -n "$five_pct" ]; then
    col=$(color_for_pct "$five_pct")
    out+="${sep}${dim}5h${reset} ${col}${five_pct}%${reset}"
fi
if [ -n "$seven_pct" ]; then
    col=$(color_for_pct "$seven_pct")
    out+="${sep}${dim}7d${reset} ${col}${seven_pct}%${reset}"
fi
out+="${session_seg}${effort_seg}"

printf "%b${clr}" "$out"
exit 0
