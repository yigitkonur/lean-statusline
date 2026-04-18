// ANSI colors + terminal capability detection.
// No deps. No assumptions about tty.

const ESC = '\x1b[';
const noColor = (s) => s;

function rgb(r, g, b) {
    return (s) => `${ESC}38;2;${r};${g};${b}m${s}${ESC}0m`;
}

export function makePalette(enabled) {
    if (!enabled) {
        return {
            blue: noColor, orange: noColor, green: noColor, cyan: noColor,
            red: noColor, yellow: noColor, white: noColor, magenta: noColor,
            dim: noColor, reset: '', clr: '',
        };
    }
    return {
        blue:    rgb(0, 153, 255),
        orange:  rgb(255, 176, 85),
        green:   rgb(0, 175, 80),
        cyan:    rgb(86, 182, 194),
        red:     rgb(255, 85, 85),
        yellow:  rgb(230, 200, 0),
        white:   rgb(220, 220, 220),
        magenta: rgb(180, 140, 255),
        dim:     (s) => `${ESC}2m${s}${ESC}0m`,
        reset:   `${ESC}0m`,
        clr:     `${ESC}K`,
    };
}

export function colorsEnabled(envOverride, cfgValue) {
    if (envOverride === '1' || envOverride === 'true') return true;
    if (envOverride === '0' || envOverride === 'false') return false;
    if (process.env.NO_COLOR) return false;
    if (process.env.LEAN_STATUSLINE_NO_COLOR) return false;
    return cfgValue !== false;
}

// Percentage → color bucket.
export function colorForPct(pct, thresholds, palette) {
    const { warn = 50, high = 70, crit = 90 } = thresholds ?? {};
    if (pct >= crit) return palette.red;
    if (pct >= high) return palette.yellow;
    if (pct >= warn) return palette.orange;
    return palette.green;
}

// Icon fallback policy:
//   "ascii"   → always ASCII
//   "unicode" → always unicode
//   "auto"    → unicode unless we have concrete evidence the terminal
//              can't render it. Modern terminals overwhelmingly do —
//              the 2020-era "allowlist of known-modern TERM_PROGRAMs"
//              turned into a liability: TERM_PROGRAM is frequently
//              unset (including when Claude Code spawns the statusline
//              in some configurations), so the allowlist was defaulting
//              to ascii even in a Ghostty/iTerm/WezTerm session.
//
//   Signals considered:
//     - TERM=dumb|linux|'' → ascii (genuine low-capability envs)
//     - SSH + no UTF-8 locale → ascii (remote tofu-box risk)
//     - otherwise → unicode
export function pickIcons(mode) {
    if (mode === 'unicode') return ICONS_UNICODE;
    if (mode === 'ascii')   return ICONS_ASCII;

    // Back-compat env overrides from pre-1.1 versions.
    if (process.env.LEAN_STATUSLINE_ASCII === '1') return ICONS_ASCII;

    // Genuine low-capability terminals.
    const term = process.env.TERM ?? '';
    if (term === 'dumb' || term === 'linux' || term === '') return ICONS_ASCII;

    // UTF-8 locale is the primary positive signal.
    const locale = `${process.env.LANG ?? ''} ${process.env.LC_CTYPE ?? ''} ${process.env.LC_ALL ?? ''}`;
    const hasUtf8 = /UTF-?8/i.test(locale);

    // SSH *without* a UTF-8 locale is the classic tofu-box scenario.
    // Modern SSH with a UTF-8 locale handles the glyphs fine.
    const isSsh = !!(process.env.SSH_TTY || process.env.SSH_CONNECTION);
    if (isSsh && !hasUtf8) return ICONS_ASCII;

    return ICONS_UNICODE;
}

const ICONS_UNICODE = {
    ctx: '✎',
    timer: '⏱',
    zap: '⚡',
    refresh: '⟳',
    bypass: '▶▶',
    ssh: '🔒',
    money: '$',
    worktree: '🌿',
    agent: '🤖',
    warn: '⚠',
    effortHigh: '●',
    effortMed: '◐',
    effortLow: '◔',
    barFilled: '●',
    barEmpty: '○',
    rail: '─',  // rail/track glyph for wide bars — reads as empty track, not circles
};

const ICONS_ASCII = {
    ctx: '%',
    timer: 't',
    zap: '!',
    refresh: '~',
    bypass: '>>',
    ssh: 'SSH',
    money: '$',
    worktree: 'wt',
    agent: 'agent',
    warn: '!!',
    effortHigh: '*',
    effortMed: '-',
    effortLow: '.',
    barFilled: '#',
    barEmpty: '-',
};

// Build a proportional bar. Width chars, filled by pct/100.
export function buildBar(pct, width, icons, palette, thresholds) {
    const p = Math.max(0, Math.min(100, pct));
    const filled = Math.round((p * width) / 100);
    const empty = width - filled;
    const filledStr = icons.barFilled.repeat(filled);
    const emptyStr = icons.barEmpty.repeat(empty);
    const color = colorForPct(p, thresholds, palette);
    return color(filledStr) + palette.dim(emptyStr);
}
