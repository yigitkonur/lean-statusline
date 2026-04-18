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

function zapPrefix(ctx) {
    if (!ctx.cfg.show.zap) return '';
    try {
        const ppid = process.ppid;
        if (!ppid || process.platform === 'win32') return '';
        const r = spawnSync('ps', ['-o', 'args=', '-p', String(ppid)], {
            encoding: 'utf8', timeout: 200,
        });
        const args = r.stdout || '';
        if (args.includes('--dangerously-skip-permissions')) {
            return `${ctx.palette.red(ctx.icons.zap)} `;
        }
    } catch { /* ignore */ }
    return '';
}

function hasZap(ctx) {
    try {
        if (process.platform === 'win32') return false;
        const r = spawnSync('ps', ['-o', 'args=', '-p', String(process.ppid)], {
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

// ── Time formatters ─────────────────────────────────────
function fmtTimeShort(epochMs) {
    if (!epochMs) return null;
    const d = new Date(epochMs);
    let h = d.getHours(), m = d.getMinutes();
    const am = h < 12 ? 'am' : 'pm';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')}${am}`;
}

function fmtDateTimeShort(epochMs) {
    if (!epochMs) return null;
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const d = new Date(epochMs);
    const day = d.getDate();
    let h = d.getHours(), m = d.getMinutes();
    const am = h < 12 ? 'am' : 'pm';
    h = h % 12 || 12;
    return `${months[d.getMonth()]} ${day}, ${h}:${m.toString().padStart(2, '0')}${am}`;
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
function renderRateFull(label, lim, ctx, barWidth = 10) {
    if (!lim || lim.pct == null) return null;
    const bar = buildBar(lim.pct, barWidth, ctx.icons, ctx.palette, ctx.cfg.thresholds);
    const pctColor = colorForPct(lim.pct, ctx.cfg.thresholds, ctx.palette);
    const pctStr = pctColor(`${lim.pct.toString().padStart(3)}%`);
    let out = `${ctx.palette.white(label)} ${bar} ${pctStr}`;
    if (lim.resetsAt) {
        const timeStr = label === 'weekly' ? fmtDateTimeShort(lim.resetsAt) : fmtTimeShort(lim.resetsAt);
        const cd = fmtCountdown(lim.resetsAt);
        out += ` ${ctx.palette.dim(ctx.icons.refresh)} ${ctx.palette.white(timeStr)}`;
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
        const size = ctx.input?.context_window?.context_window_size || 200000;
        const u = ctx.input?.context_window?.current_usage ?? {};
        const used = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        const pct = Math.min(100, Math.round((used * 100) / (size || 200000)));
        return `${ctx.palette.dim(`${ctx.icons.ctx} `)}${fmtPct(pct, ctx)}`;
    },

    dir(ctx) {
        const cwd = ctx.input?.cwd || process.cwd();
        const name = cwd.split(/[/\\]/).filter(Boolean).pop() || cwd;
        const zap = zapPrefix(ctx);
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

    // Full-width context usage bar (88 chars wide by default).
    'context-bar'(ctx) {
        const width = ctx.cfg.contextBarWidth ?? 88;
        const size = ctx.input?.context_window?.context_window_size || 200000;
        const u = ctx.input?.context_window?.current_usage ?? {};
        const used = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        const pct = Math.min(100, Math.round((used * 100) / (size || 200000)));
        const filled = Math.floor((pct * width) / 100);
        const empty = width - filled;
        const filledStr = ctx.icons.barFilled.repeat(filled);
        const emptyStr = ctx.icons.barEmpty.repeat(empty);
        // Use a muted gray for the bar so it reads as secondary chrome.
        const filledPart = ctx.palette.dim(filledStr);
        const emptyPart = ctx.palette.dim(emptyStr);
        return `${ctx.palette.white('context')} ${filledPart}${emptyPart}`;
    },

    // ▶▶ bypass permissions on (shift+tab to cycle)  — shows only when active.
    'bypass-banner'(ctx) {
        if (!hasZap(ctx)) return null;
        const arrow = ctx.icons.bypass;
        return `${ctx.palette.red(arrow)} ${ctx.palette.red('bypass permissions on')} ${ctx.palette.dim('(shift+tab to cycle)')}`;
    },

    session(ctx) {
        const st = ctx.input?.session?.start_time;
        if (!st) return null;
        const epoch = Date.parse(st);
        if (!epoch) return null;
        const el = Math.max(0, Math.floor((Date.now() - epoch) / 1000));
        let dur;
        if (el >= 3600) dur = `${Math.floor(el / 3600)}h${Math.floor((el % 3600) / 60)}m`;
        else if (el >= 60) dur = `${Math.floor(el / 60)}m`;
        else dur = `${el}s`;
        return `${ctx.palette.dim(`${ctx.icons.timer} `)}${ctx.palette.white(dur)}`;
    },

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
        let level = process.env.CLAUDE_CODE_EFFORT_LEVEL;
        if (!level) {
            const settingsPath = join(homedir(), '.claude', 'settings.json');
            if (existsSync(settingsPath)) {
                try {
                    const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
                    level = s?.env?.CLAUDE_CODE_EFFORT_LEVEL;
                } catch { /* ignore */ }
            }
        }
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
};

// Group flat segments into lines (split on "\n" pseudo-segments), render each
// segment, drop nulls, join with separator within a line, join lines with \n.
export function renderLine(ctx) {
    const lines = [[]];
    for (const name of ctx.cfg.segments) {
        if (name === LINE_BREAK) {
            lines.push([]);
            continue;
        }
        const fn = SEGMENTS[name];
        if (!fn) continue;
        const rendered = fn(ctx);
        if (rendered != null && rendered !== '') lines[lines.length - 1].push(rendered);
    }

    const sep = ` ${ctx.palette.dim(ctx.cfg.separator)} `;
    const joined = lines
        .map(parts => parts.length ? parts.join(sep) + (ctx.palette.clr || '') : null)
        .filter(l => l !== null);
    return joined.join('\n');
}
