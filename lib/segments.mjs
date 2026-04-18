// Segment registry + renderLine with multi-line support.
// "\n" in segments[] produces a line break. Segments returning null are skipped
// (no trailing separator). The line-join logic handles consecutive \n, leading/
// trailing newlines, and empty lines gracefully.
import { existsSync } from 'node:fs';
import { normalize } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir, hostname } from 'node:os';
import { gitState } from './git.mjs';
import { colorForPct, buildBar } from './colors.mjs';
import { paceDelta as readPaceDelta } from './pace.mjs';
import { probe, UNSET } from './probe.mjs';
import { shouldRender } from './conditionals.mjs';

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

// Pick the hostname for display on the server side.
// `short` (default): `mac-mini.local` → `mac-mini` — matches the typical ssh-config alias.
// `full`: keep the FQDN as-is, for infra hosts where the domain disambiguates.
function pickHostname(style = 'short') {
    try {
        const h = hostname() || '';
        if (style === 'full') return h || null;
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
function detectSshHost(hostnameStyle = 'short') {
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
                return { label: pickHostname(hostnameStyle) || 'lan', kind: 'lan' };
            }
            // Public: show the IP — it's unambiguous and you usually want to know.
            return { label: serverIp, kind: 'remote' };
        }
    }

    if (process.env.SSH_TTY || process.env.SSH_CLIENT) {
        return { label: pickHostname(hostnameStyle) || 'remote', kind: 'lan' };
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

function fmtPct(pct, ctx, barWidth) {
    const color = colorForPct(pct, ctx.cfg.thresholds, ctx.palette);
    // barWidth is a caller contract. Fall back to the rate-inline default so a
    // segment forgetting to pass a width still gets a reasonable 10-wide bar.
    const w = barWidth ?? ctx.cfg.rateBarWidth ?? 10;
    if (ctx.cfg.show.bars) {
        return `${buildBar(pct, w, ctx.icons, ctx.palette, ctx.cfg.thresholds)} ${color(`${pct}%`)}`;
    }
    return color(`${pct}%`);
}

// ── Format helpers (wired from user-editable config.mjs fields) ─────

// Model display_name: "Opus 4.7 (1M context)" in three forms.
function formatModelName(name, style) {
    if (!name) return name;
    if (style === 'short') return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
    if (style === 'code') {
        return name.toLowerCase()
            .replace(/\([^)]*\)/g, '')
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || name;
    }
    return name;
}

// Directory: smart / basename / tilde-home / full.
//
// `smart` is the default and the user-meaningful mode: show the full
// tilde-collapsed path (~/dev/<project>) when it's short enough to fit
// comfortably, otherwise fall back to just the basename. `maxLen` is
// that threshold — 30 by default, covers most ~/dev/<project> trees.
function formatDir(cwd, style, maxLen = 30) {
    if (!cwd) return cwd;
    const basename = () => cwd.split(/[/\\]/).filter(Boolean).pop() || cwd;
    if (style === 'basename') return basename();
    const tildeForm = () => {
        const h = homedir();
        if (h && cwd === h) return '~';
        if (h && cwd.startsWith(h + '/')) return '~' + cwd.slice(h.length);
        return cwd;
    };
    if (style === 'tilde') return tildeForm();
    if (style === 'full')  return cwd;
    // smart: tilde if it fits, else basename.
    const tilde = tildeForm();
    return tilde.length <= (maxLen || 30) ? tilde : basename();
}

function normalizeWorkspacePath(value) {
    if (typeof value !== 'string' || value.length === 0) return null;
    return normalize(value.replace(/\\/g, '/'));
}

// Branch wrapper glyphs. `bare` omits brackets entirely.
const BRANCH_BRACKETS = Object.freeze({
    paren:   ['(', ')'],
    bracket: ['[', ']'],
    brace:   ['{', '}'],
    bare:    ['', ''],
});

// Truncate long branch names (feat/ABC-1234-…). Keeps head + last 4 for
// merge-branch identity. `max === 0` disables truncation.
function truncBranch(name, max) {
    if (!max || name.length <= max) return name;
    const tail = 4;
    const head = Math.max(1, max - tail - 1);
    return `${name.slice(0, head)}…${name.slice(-tail)}`;
}

// 1234567 → "1.2M" / 1234 → "1.2k". Small integers stay untouched.
function compactInt(n) {
    const sign = n < 0 ? '-' : '';
    const v = Math.abs(n);
    if (v >= 1e6) return sign + (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1e3) return sign + (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return sign + String(v);
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
export function resolveEffortLevel(input = {}, options = {}) {
    const level = probe('effortLevel', input, options);
    return level === UNSET ? null : level;
}

// Read context-usage percentage — prefer the pre-calculated field the spec
// ships, fall back to the legacy manual sum for older CC builds.
export function readContextPct(input) {
    const pre = probe('context_window.used_percentage', input);
    if (pre != null && Number.isFinite(pre)) {
        return Math.min(100, Math.round(pre));
    }
    const size = probe('context_window.context_window_size', input);
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

function renderPaceArrow(lim, windowKey, ctx) {
    if (ctx.cfg.show.paceDelta === false) return '';
    const { delta, band } = readPaceDelta(lim?.pct, lim?.resetsAt, windowKey, Date.now(), ctx.cfg.pace);
    if (delta == null || band === 'neutral' || band === 'unknown') return '';
    const rounded = Math.max(-99, Math.min(99, Math.round(delta)));
    const sign = rounded > 0 ? '+' : '';
    const arrow = band === 'fast'
        ? (ctx.icons.ctx === '%' ? '^' : '⇡')
        : (ctx.icons.ctx === '%' ? 'v' : '⇣');
    const color = band === 'fast' ? ctx.palette.orange : ctx.palette.green;
    return ` ${color(`${arrow}${sign}${rounded}`)}`;
}

// ── Helpers for rate-limit "full" segments ──────────────
// Output: `<label> <bar> <pct>% (in 1h30m)`  — the absolute reset clock
// time was removed because the countdown carries the same information
// and reads faster at a glance. Users who want the wall-clock time back
// can re-add it by customizing the renderer.
//
// Honors `show.bars`: with bars off we collapse to `<label> <pct>% (in …)`
// so the toggle truly silences every bar-producing segment.
function renderRateFull(label, lim, ctx, barWidth, windowKey) {
    if (!lim || lim.pct == null) return null;
    const w = barWidth ?? ctx.cfg.rateBarWidth ?? 10;
    const pctColor = colorForPct(lim.pct, ctx.cfg.thresholds, ctx.palette);
    const pctStr = pctColor(`${lim.pct.toString().padStart(3)}%`);
    const bar = ctx.cfg.show.bars
        ? ` ${buildBar(lim.pct, w, ctx.icons, ctx.palette, ctx.cfg.thresholds)}`
        : '';
    let out = `${ctx.palette.white(label)}${bar} ${pctStr}${renderPaceArrow(lim, windowKey, ctx)}`;
    if (lim.resetsAt) {
        const cd = fmtCountdown(lim.resetsAt);
        if (cd) out += ` ${ctx.palette.dim(`(${cd})`)}`;
    }
    return out;
}

// ── Segment registry ────────────────────────────────────
export const SEGMENTS = {
    model(ctx) {
        const raw = probe('model.display_name', ctx.input);
        return ctx.palette.blue(formatModelName(raw, ctx.cfg.modelFormat));
    },

    ctx(ctx) {
        const pct = ctx.contextPct;
        if (pct == null) return null;
        // ctx is the busiest signal on the line, so its inline bar is
        // deliberately wider (default 20) than the 5h/7d rate bars (10).
        // User can retune via cfg.ctxBarWidth.
        const w = ctx.cfg.ctxBarWidth ?? 20;
        return `${ctx.palette.dim(`${ctx.icons.ctx} `)}${fmtPct(pct, ctx, w)}`;
    },

    dir(ctx) {
        // Spec: prefer workspace.current_dir over cwd (they're equal, but the
        // former is canonical for consistency with workspace.project_dir).
        const cwd = probe('workspace.current_dir', ctx.input)
            || probe('cwd', ctx.input)
            || process.cwd();
        const proj = probe('workspace.project_dir', ctx.input);
        const name = formatDir(cwd, ctx.cfg.dirStyle, ctx.cfg.dirMaxLen);
        const zap = (ctx.cfg.show.zap && ctx.dangerousPerms)
            ? `${ctx.palette.red(ctx.icons.zap)} ` : '';
        let out = `${zap}${ctx.palette.cyan(name)}`;
        if (ctx.cfg.show.branch) {
            const { branch, dirty } = gitState(cwd);
            if (branch) {
                const [open, close] = BRANCH_BRACKETS[ctx.cfg.branchStyle] ?? BRANCH_BRACKETS.paren;
                const trimmed = truncBranch(branch, ctx.cfg.branchMaxLen || 0);
                const dirtyMark = (dirty && ctx.cfg.show.dirty) ? ctx.palette.red('*') : '';
                const body = `${ctx.palette.green(open)}${ctx.palette.green(trimmed)}${dirtyMark}${ctx.palette.green(close)}`;
                // 'bare' style omits the wrappers entirely but keeps the dirty marker attached.
                out += ` ${body}`;
            }
        }
        const cwdNormalized = normalizeWorkspacePath(cwd);
        const projNormalized = normalizeWorkspacePath(proj);
        if (ctx.cfg.show.projectDirCrumb !== false && projNormalized && cwdNormalized !== projNormalized) {
            const arrow = ctx.icons.ssh === 'SSH' ? '<-' : '⇢';
            const projectName = formatDir(projNormalized, 'basename', ctx.cfg.dirMaxLen);
            out += ` ${ctx.palette.dim(`${arrow} from ${projectName}`)}`;
        }
        return out;
    },

    '5h'(ctx) {
        const lim = ctx.rateLimits?.fiveHour;
        if (lim?.pct == null) return null;
        return `${ctx.palette.dim('5h')} ${fmtPct(lim.pct, ctx)}${renderPaceArrow(lim, 'five_hour', ctx)}`;
    },

    '7d'(ctx) {
        const lim = ctx.rateLimits?.sevenDay;
        if (lim?.pct == null) return null;
        return `${ctx.palette.dim('7d')} ${fmtPct(lim.pct, ctx)}${renderPaceArrow(lim, 'seven_day', ctx)}`;
    },

    // Full rate-limit lines (bar + pct + reset time + countdown).
    'rate-5h-full'(ctx) {
        return renderRateFull('current', ctx.rateLimits?.fiveHour, ctx, undefined, 'five_hour');
    },
    'rate-7d-full'(ctx) {
        return renderRateFull('weekly', ctx.rateLimits?.sevenDay, ctx, undefined, 'seven_day');
    },

    // Full-width context usage bar. Uses a "rail" glyph for the empty
    // portion (─ instead of ○) so low-usage states don't look like a
    // fence of circles. Filled stays ● to read as the "tank level."
    //
    // Honors `show.bars` — the segment is bar-only, so when bars are
    // globally off we render nothing (the toggle's whole point).
    'context-bar'(ctx) {
        if (!ctx.cfg.show.bars) return null;
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
        const ms = probe('cost.total_duration_ms', ctx.input);
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
        const host = detectSshHost(ctx.cfg.hostnameStyle);
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
        const usd = probe('cost.total_cost_usd', ctx.input);
        if (usd == null) return null;
        const precision = Number.isFinite(ctx.cfg.costPrecision) ? ctx.cfg.costPrecision : 2;
        const label = `$${Number(usd).toFixed(precision)}`;
        return `${ctx.palette.dim(ctx.icons.money)} ${ctx.palette.yellow(label)}`;
    },

    // Lines added / removed across the session. Useful at-a-glance diff size.
    lines(ctx) {
        const added = probe('cost.total_lines_added', ctx.input);
        const removed = probe('cost.total_lines_removed', ctx.input);
        if (added == null && removed == null) return null;
        const fmt = ctx.cfg.compactNumbers ? compactInt : (n) => String(n);
        const parts = [];
        if (added)   parts.push(ctx.palette.green(`+${fmt(added)}`));
        if (removed) parts.push(ctx.palette.red(`-${fmt(removed)}`));
        if (!parts.length) return null;
        return parts.join(' ');
    },

    // Named worktree (only during --worktree sessions or when cwd is inside a
    // linked worktree). Pulls from the spec's worktree.* block first, falls
    // back to workspace.git_worktree.
    worktree(ctx) {
        const name = probe('worktree.name', ctx.input) ?? probe('workspace.git_worktree', ctx.input);
        if (!name || name === UNSET) return null;
        const original = probe('worktree.original_branch', ctx.input);
        const originalArrow = ctx.icons.ssh === 'SSH' ? '<-' : '←';
        const originalSuffix = (original && original !== UNSET)
            ? ` ${ctx.palette.dim(originalArrow)} ${ctx.palette.dim(original)}`
            : '';
        return `${ctx.palette.dim(ctx.icons.worktree)} ${ctx.palette.cyan(name)}${originalSuffix}`;
    },

    // Named subagent (--agent or agent settings).
    agent(ctx) {
        const name = probe('agent.name', ctx.input);
        if (!name) return null;
        return `${ctx.palette.dim(ctx.icons.agent)} ${ctx.palette.magenta(name)}`;
    },

    // Vim mode indicator. Only present when vim editor mode is enabled.
    vim(ctx) {
        const mode = probe('vim.mode', ctx.input);
        if (!mode) return null;
        const color = mode === 'INSERT' ? ctx.palette.green : ctx.palette.blue;
        return color(`-- ${mode} --`);
    },

    // Custom session name from --name or /rename. Absent by default.
    'session-name'(ctx) {
        const name = probe('session_name', ctx.input);
        if (!name) return null;
        return ctx.palette.dim(`[${name}]`);
    },

    // Output style — shown unless "default" (assume users know when they've
    // switched styles and want a reminder on screen).
    'output-style'(ctx) {
        const name = probe('output_style.name', ctx.input);
        if (!name || name === 'default') return null;
        return ctx.palette.dim(name);
    },

    // Loud badge when the most recent response exceeds 200k tokens. Fixed
    // threshold per the spec, not tied to context_window_size.
    overflow(ctx) {
        if (!probe('exceeds_200k_tokens', ctx.input)) return null;
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
    const rawSegments = ctx.cfg.segments ?? [];
    let segments = rawSegments.filter(name => (SEGMENT_ALIASES[name] || name) !== 'worktree');
    const worktreeActive = !!(probe('worktree.name', ctx.input) ?? probe('workspace.git_worktree', ctx.input));
    if (ctx.cfg.show.worktree !== false) {
        if (worktreeActive) {
            const dirIdx = segments.indexOf('dir');
            const insertAt = dirIdx >= 0 ? dirIdx : segments.length;
            segments.splice(insertAt, 0, 'worktree');
        } else if (rawSegments.some(name => (SEGMENT_ALIASES[name] || name) === 'worktree')) {
            segments = rawSegments.slice();
        }
    }

    const lines = [[]];
    const seen = new Set();
    for (const rawName of segments) {
        if (rawName === LINE_BREAK) {
            lines.push([]);
            continue;
        }
        const name = SEGMENT_ALIASES[rawName] || rawName;
        if (name === 'worktree' && ctx.cfg.show.worktree === false) continue;
        if (seen.has(name)) continue;  // alias + canonical both listed → render once
        const fn = SEGMENTS[name];
        if (!fn) continue;
        if (!shouldRender(name, ctx)) continue;
        const rendered = fn(ctx);
        if (rendered != null && rendered !== '') {
            lines[lines.length - 1].push(rendered);
            seen.add(name);
        }
    }

    // Spacing around separators: tight (no pad), normal (single space), loose (double).
    const pad = ctx.cfg.spacing === 'tight' ? ''
              : ctx.cfg.spacing === 'loose' ? '  '
              : ' ';
    const sep = `${pad}${ctx.palette.dim(ctx.cfg.separator)}${pad}`;
    const joined = lines
        .map(parts => parts.length ? parts.join(sep) + (ctx.palette.clr || '') : null)
        .filter(l => l !== null);
    return joined.join('\n');
}
