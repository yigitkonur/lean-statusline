// Pure segment renderers. Each takes (ctx) → string | null.
// null = skip (no trailing separator).
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { gitState } from './git.mjs';
import { colorForPct, buildBar } from './colors.mjs';

function zapPrefix(ctx) {
    if (!ctx.cfg.show.zap) return '';
    // Claude Code propagates --dangerously-skip-permissions via the parent process.
    // We can't read parent argv portably from node, so look for the flag in env markers
    // or ppid argv on POSIX. Best-effort.
    try {
        const ppid = process.ppid;
        if (!ppid) return '';
        if (process.platform === 'win32') return '';
        const r = spawnSync('ps', ['-o', 'args=', '-p', String(ppid)], {
            encoding: 'utf8', timeout: 200,
        });
        const args = (r.stdout || '');
        if (args.includes('--dangerously-skip-permissions')) {
            return `${ctx.palette.red(ctx.icons.zap)} `;
        }
    } catch { /* ignore */ }
    return '';
}

function fmtPct(pct, ctx) {
    const color = colorForPct(pct, ctx.cfg.thresholds, ctx.palette);
    if (ctx.cfg.show.bars) {
        return `${buildBar(pct, 8, ctx.icons, ctx.palette, ctx.cfg.thresholds)} ${color(`${pct}%`)}`;
    }
    return color(`${pct}%`);
}

// ── Segment registry ───────────────────────────────────
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
        const p = ctx.rateLimits?.fiveHourPct;
        if (p == null) return null;
        return `${ctx.palette.dim('5h')} ${fmtPct(p, ctx)}`;
    },

    '7d'(ctx) {
        const p = ctx.rateLimits?.sevenDayPct;
        if (p == null) return null;
        return `${ctx.palette.dim('7d')} ${fmtPct(p, ctx)}`;
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

    effort(ctx) {
        // Claude Code exports settings.json#env entries to the statusline process.
        // CLAUDE_CODE_EFFORT_LEVEL is the canonical name. Fall back to reading the env
        // block from settings.json so we work even if Claude Code didn't export it.
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
            case 'high': icon = ctx.icons.effortHigh; break;
            case 'medium': icon = ctx.icons.effortMed; break;
            case 'low': icon = ctx.icons.effortLow; break;
            case 'auto':
            default: icon = ctx.icons.effortMed; break;
        }
        const color = level === 'high' ? ctx.palette.magenta : ctx.palette.dim;
        return color(`${icon} ${level}`);
    },
};

export function renderLine(ctx) {
    const parts = [];
    for (const name of ctx.cfg.segments) {
        const fn = SEGMENTS[name];
        if (!fn) continue;
        const out = fn(ctx);
        if (out != null && out !== '') parts.push(out);
    }
    const sep = ` ${ctx.palette.dim(ctx.cfg.separator)} `;
    return parts.join(sep) + (ctx.palette.clr || '');
}
