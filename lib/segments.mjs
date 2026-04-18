// Segment registry + renderLine with multi-line support.
// "\n" in segments[] produces a line break. Segments returning null are skipped
// (no trailing separator). The line-join logic handles consecutive \n, leading/
// trailing newlines, and empty lines gracefully.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir, hostname } from 'node:os';
import { gitState } from './git.mjs';
import { colorForPct, buildBar } from './colors.mjs';

const LINE_BREAK = '\n';

// Detect whether an IPv4 address is in a private/LAN/VPN range.
// RFC 1918, loopback, link-local, and CGNAT/Tailscale blocks.
function isPrivateIp(ip) {
    if (!ip) return false;
    // IPv6 loopback / link-local / unique-local.
    if (ip === '::1' || ip.startsWith('fe80') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
    // IPv4 strings.
    const parts = ip.split('.').map(n => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false;
    const [a, b] = parts;
    if (a === 10) return true;                                // 10.0.0.0/8
    if (a === 127) return true;                               // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;                  // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true;         // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                  // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;        // 100.64.0.0/10 CGNAT / Tailscale
    return false;
}

// Pick the best short hostname for display on the server side.
// `mac-mini.local` → `mac-mini`. Matches the typical ssh-config alias.
function shortHostname() {
    try {
        const h = hostname() || '';
        return h.split('.')[0] || h || null;
    } catch { return null; }
}

// SSH_CONNECTION format: "<client_ip> <client_port> <server_ip> <server_port>"
//
// Returns { label, kind } where kind is:
//   'lan'    — private IP range (home net, VPN, tailscale). Prefers hostname.
//   'remote' — public IP. Shows the IP so you know it's an internet box.
//   null     — not on SSH.
//
// Override order:
//   1. LEAN_STATUSLINE_SSH_HOST (explicit label, kind=remote by default)
//   2. SSH_CONNECTION parse → classify
//   3. SSH_TTY/SSH_CLIENT fallback → hostname, kind=lan (no IP to classify)
function detectSshHost() {
    const override = process.env.LEAN_STATUSLINE_SSH_HOST;
    if (override) {
        return { label: override, kind: process.env.LEAN_STATUSLINE_SSH_KIND || 'remote' };
    }

    const conn = process.env.SSH_CONNECTION;
    if (conn) {
        const parts = conn.trim().split(/\s+/);
        const serverIp = parts.length >= 3 ? parts[2] : null;
        if (serverIp) {
            if (isPrivateIp(serverIp)) {
                // Private: show hostname (usually matches ssh alias).
                return { label: shortHostname() || 'lan', kind: 'lan' };
            }
            // Public: show the IP — it's unambiguous and you usually want to know.
            return { label: serverIp, kind: 'remote' };
        }
    }

    if (process.env.SSH_TTY || process.env.SSH_CLIENT) {
        return { label: shortHostname() || 'remote', kind: 'lan' };
    }
    return null;
}

// One process spawn per render, stashed on ctx by renderFromStdin().
// Both the `dir` zap prefix and the `bypass-banner` segment consult it.
export function detectDangerousPerms() {
    if (process.platform === 'win32') return false;
    const ppid = process.ppid;
    if (!ppid) return false;
    try {
        const r = spawnSync('ps', ['-o', 'args=', '-p', String(ppid)], {
            encoding: 'utf8', timeout: 200,
        });
        return (r.stdout || '').includes('--dangerously-skip-permissions');
    } catch { return false; }
}

function fmtPct(pct, ctx, barWidth = 8) {
    const color = colorForPct(pct, ctx.cfg.thresholds, ctx.palette);
    if (ctx.cfg.show.bars) {
        return `${buildBar(pct, barWidth, ctx.icons, ctx.palette, ctx.cfg.thresholds)} ${color(`${pct}%`)}`;
    }
    return color(`${pct}%`);
}

// Milliseconds → "1h23m" / "45m 12s" / "3s". Shared by elapsed + cost segments.
function fmtDuration(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s >= 3600) return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
    if (s >= 60)   return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${s}s`;
}

// Called once per render by bin/lean-statusline.mjs and stashed on ctx.
// Env var wins; settings.json#env fallback is a one-time disk read rather
// than one per render as the effort segment used to do.
export function resolveEffortLevel() {
    const envLevel = process.env.CLAUDE_CODE_EFFORT_LEVEL;
    if (envLevel) return envLevel;
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    try {
        const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
        return s?.env?.CLAUDE_CODE_EFFORT_LEVEL || null;
    } catch {
        return null;
    }
}

// Read context-usage percentage — prefer the pre-calculated field the spec
// ships, fall back to the legacy manual sum for older CC builds.
export function readContextPct(input) {
    const pre = input?.context_window?.used_percentage;
    if (pre != null && Number.isFinite(pre)) {
        return Math.min(100, Math.round(pre));
    }
    const size = input?.context_window?.context_window_size || 200000;
    const u = input?.context_window?.current_usage;
    if (!u) return null;
    const used = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    if (used === 0 && u.input_tokens == null) return null;  // pre-first-API-call
    return Math.min(100, Math.round((used * 100) / (size || 200000)));
}

function fmtCountdown(epochMs) {
    if (!epochMs) return null;
    const remaining = Math.max(0, Math.floor((epochMs - Date.now()) / 1000));
    if (remaining === 0) return 'now';
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    if (days > 0) return `in ${days}d${hours}h`;
    if (hours > 0) return `in ${hours}h${mins.toString().padStart(2, '0')}m`;
    return `in ${mins}m`;
}

// ── Helpers for rate-limit "full" segments ──────────────
// Output: `<label> <bar> <pct>% (in 1h30m)`  — the absolute reset clock
// time was removed because the countdown carries the same information
// and reads faster at a glance. Users who want the wall-clock time back
// can re-add it by customizing the renderer.
function renderRateFull(label, lim, ctx, barWidth = 10) {
    if (!lim || lim.pct == null) return null;
    const bar = buildBar(lim.pct, barWidth, ctx.icons, ctx.palette, ctx.cfg.thresholds);
    const pctColor = colorForPct(lim.pct, ctx.cfg.thresholds, ctx.palette);
    const pctStr = pctColor(`${lim.pct.toString().padStart(3)}%`);
    let out = `${ctx.palette.white(label)} ${bar} ${pctStr}`;
    if (lim.resetsAt) {
        const cd = fmtCountdown(lim.resetsAt);
        if (cd) out += ` ${ctx.palette.dim(`(${cd})`)}`;
    }
    return out;
}

// ── Segment registry ────────────────────────────────────
export const SEGMENTS = {
    model(ctx) {
        const name = ctx.input?.model?.display_name ?? 'Claude';
        return ctx.palette.blue(name);
    },

    ctx(ctx) {
        const pct = ctx.contextPct;
        if (pct == null) return null;
        return `${ctx.palette.dim(`${ctx.icons.ctx} `)}${fmtPct(pct, ctx)}`;
    },

    dir(ctx) {
        // Spec: prefer workspace.current_dir over cwd (they're equal, but the
        // former is canonical for consistency with workspace.project_dir).
        const cwd = ctx.input?.workspace?.current_dir || ctx.input?.cwd || process.cwd();
        const name = cwd.split(/[/\\]/).filter(Boolean).pop() || cwd;
        const zap = (ctx.cfg.show.zap && ctx.dangerousPerms)
            ? `${ctx.palette.red(ctx.icons.zap)} ` : '';
        let out = `${zap}${ctx.palette.cyan(name)}`;
        if (ctx.cfg.show.branch) {
            const { branch, dirty } = gitState(cwd);
            if (branch) {
                const dirtyMark = (dirty && ctx.cfg.show.dirty) ? ctx.palette.red('*') : '';
                out += ` ${ctx.palette.green('(')}${ctx.palette.green(branch)}${dirtyMark}${ctx.palette.green(')')}`;
            }
        }
        return out;
    },

    '5h'(ctx) {
        const p = ctx.rateLimits?.fiveHour?.pct;
        if (p == null) return null;
        return `${ctx.palette.dim('5h')} ${fmtPct(p, ctx)}`;
    },

    '7d'(ctx) {
        const p = ctx.rateLimits?.sevenDay?.pct;
        if (p == null) return null;
        return `${ctx.palette.dim('7d')} ${fmtPct(p, ctx)}`;
    },

    // Full rate-limit lines (bar + pct + reset time + countdown).
    'rate-5h-full'(ctx) {
        return renderRateFull('current', ctx.rateLimits?.fiveHour, ctx);
    },
    'rate-7d-full'(ctx) {
        return renderRateFull('weekly', ctx.rateLimits?.sevenDay, ctx);
    },

    // Full-width context usage bar. Uses a "rail" glyph for the empty
    // portion (─ instead of ○) so low-usage states don't look like a
    // fence of circles. Filled stays ● to read as the "tank level."
    'context-bar'(ctx) {
        const width = ctx.cfg.contextBarWidth ?? 75;
        const pct = ctx.contextPct ?? 0;
        const filled = Math.floor((pct * width) / 100);
        const empty = width - filled;
        const rail = ctx.icons.rail ?? (ctx.icons.ctx === '%' ? '-' : '─');
        const filledStr = ctx.icons.barFilled.repeat(filled);
        const emptyStr = rail.repeat(empty);
        // Color-grade the filled portion; rail stays muted throughout.
        const filledColor = colorForPct(pct, ctx.cfg.thresholds, ctx.palette);
        return `${ctx.palette.white('context')} ${filledColor(filledStr)}${ctx.palette.dim(emptyStr)}`;
    },

    // ▶▶ bypass permissions on (shift+tab to cycle)  — shows only when active.
    'bypass-banner'(ctx) {
        if (!ctx.dangerousPerms) return null;
        const arrow = ctx.icons.bypass;
        return `${ctx.palette.red(arrow)} ${ctx.palette.red('bypass permissions on')} ${ctx.palette.dim('(shift+tab to cycle)')}`;
    },

    elapsed(ctx) {
        const ms = ctx.input?.cost?.total_duration_ms;
        if (ms == null) return null;
        const dur = fmtDuration(ms);
        return `${ctx.palette.dim(`${ctx.icons.timer} `)}${ctx.palette.white(dur)}`;
    },
    // Alias for configs that still name the segment `session`.
    session(ctx) { return SEGMENTS.elapsed(ctx); },

    // Renders only when running over SSH. Classifies the server as lan
    // (private IP / Tailscale / hostname-only) vs remote (public IP) and
    // colors accordingly — cyan for lan, magenta for public. Silent on
    // local sessions.
    ssh(ctx) {
        const host = detectSshHost();
        if (!host) return null;
        const color = host.kind === 'lan' ? ctx.palette.cyan : ctx.palette.magenta;
        return `${color(ctx.icons.ssh)} ${color(host.label)}`;
    },

    effort(ctx) {
        const level = ctx.effortLevel;
        if (!level) return null;
        let icon;
        switch (level) {
            case 'high':   icon = ctx.icons.effortHigh; break;
            case 'medium': icon = ctx.icons.effortMed;  break;
            case 'low':    icon = ctx.icons.effortLow;  break;
            case 'auto':
            default:       icon = ctx.icons.effortMed;  break;
        }
        const color = level === 'high' ? ctx.palette.magenta : ctx.palette.dim;
        return color(`${icon} ${level}`);
    },

    // ── Spec-field-driven segments ──────────────────────
    // Each returns null when the source field is absent → zero chrome.

    // Session cost in USD. Computed client-side by Claude Code.
    cost(ctx) {
        const usd = ctx.input?.cost?.total_cost_usd;
        if (usd == null) return null;
        const label = `$${Number(usd).toFixed(2)}`;
        return `${ctx.palette.dim(ctx.icons.money)} ${ctx.palette.yellow(label)}`;
    },

    // Lines added / removed across the session. Useful at-a-glance diff size.
    lines(ctx) {
        const added = ctx.input?.cost?.total_lines_added;
        const removed = ctx.input?.cost?.total_lines_removed;
        if (added == null && removed == null) return null;
        const parts = [];
        if (added)   parts.push(ctx.palette.green(`+${added}`));
        if (removed) parts.push(ctx.palette.red(`-${removed}`));
        if (!parts.length) return null;
        return parts.join(' ');
    },

    // Named worktree (only during --worktree sessions or when cwd is inside a
    // linked worktree). Pulls from the spec's worktree.* block first, falls
    // back to workspace.git_worktree.
    worktree(ctx) {
        const name = ctx.input?.worktree?.name || ctx.input?.workspace?.git_worktree;
        if (!name) return null;
        return `${ctx.palette.dim(ctx.icons.worktree)} ${ctx.palette.cyan(name)}`;
    },

    // Named subagent (--agent or agent settings).
    agent(ctx) {
        const name = ctx.input?.agent?.name;
        if (!name) return null;
        return `${ctx.palette.dim(ctx.icons.agent)} ${ctx.palette.magenta(name)}`;
    },

    // Vim mode indicator. Only present when vim editor mode is enabled.
    vim(ctx) {
        const mode = ctx.input?.vim?.mode;
        if (!mode) return null;
        const color = mode === 'INSERT' ? ctx.palette.green : ctx.palette.blue;
        return color(`-- ${mode} --`);
    },

    // Custom session name from --name or /rename. Absent by default.
    'session-name'(ctx) {
        const name = ctx.input?.session_name;
        if (!name) return null;
        return ctx.palette.dim(`[${name}]`);
    },

    // Output style — shown unless "default" (assume users know when they've
    // switched styles and want a reminder on screen).
    'output-style'(ctx) {
        const name = ctx.input?.output_style?.name;
        if (!name || name === 'default') return null;
        return ctx.palette.dim(name);
    },

    // Loud badge when the most recent response exceeds 200k tokens. Fixed
    // threshold per the spec, not tied to context_window_size.
    overflow(ctx) {
        if (!ctx.input?.exceeds_200k_tokens) return null;
        return ctx.palette.red(`${ctx.icons.warn} >200k`);
    },
};

// Aliases that resolve to a canonical segment. If a config has both the
// alias and the canonical name (possible via the wizard since KNOWN_SEGMENTS
// exposes both), we only render once — otherwise the output shows the same
// thing twice. This set is consulted during render-time de-dup below.
const SEGMENT_ALIASES = { session: 'elapsed' };

// Group flat segments into lines (split on "\n" pseudo-segments), render each
// segment, drop nulls, join with separator within a line, join lines with \n.
// Also de-duplicates aliases so `['session', 'elapsed']` doesn't produce
// `⏱ 45m · ⏱ 45m` — first occurrence wins.
export function renderLine(ctx) {
    const lines = [[]];
    const seen = new Set();
    for (const rawName of ctx.cfg.segments) {
        if (rawName === LINE_BREAK) {
            lines.push([]);
            continue;
        }
        const name = SEGMENT_ALIASES[rawName] || rawName;
        if (seen.has(name)) continue;  // alias + canonical both listed → render once
        const fn = SEGMENTS[name];
        if (!fn) continue;
        const rendered = fn(ctx);
        if (rendered != null && rendered !== '') {
            lines[lines.length - 1].push(rendered);
            seen.add(name);
        }
    }

    const sep = ` ${ctx.palette.dim(ctx.cfg.separator)} `;
    const joined = lines
        .map(parts => parts.length ? parts.join(sep) + (ctx.palette.clr || '') : null)
        .filter(l => l !== null);
    return joined.join('\n');
}
