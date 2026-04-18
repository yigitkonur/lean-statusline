// ANSI colors + terminal capability detection.
// No deps. No assumptions about tty.

const ESC = '\x1b[';
const noColor = (s) => s;

function rgb(r, g, b) {
    return (s) => `${ESC}38;2;${r};${g};${b}m${s}${ESC}0m`;
}

// ── Palettes ────────────────────────────────────────────
// Each palette names the same 8 semantic slots so every segment
// consumes colors symbolically (palette.blue, palette.green, …).
// Changing the palette swaps the underlying RGB but preserves
// intent — green stays the "healthy/low" hue in every theme.
//
// To add a palette: append an entry. Wizard/picker enumerate
// automatically via PALETTE_NAMES.
const PALETTES = Object.freeze({
    // The original lean-statusline palette. Punchy, vaguely terminal-retro.
    'default': {
        blue:    [0, 153, 255],
        orange:  [255, 176, 85],
        green:   [0, 175, 80],
        cyan:    [86, 182, 194],
        red:     [255, 85, 85],
        yellow:  [230, 200, 0],
        white:   [220, 220, 220],
        magenta: [180, 140, 255],
    },
    // Nord — muted arctic blues/greens.
    'nord': {
        blue:    [129, 161, 193],
        orange:  [208, 135, 112],
        green:   [163, 190, 140],
        cyan:    [136, 192, 208],
        red:     [191, 97, 106],
        yellow:  [235, 203, 139],
        white:   [216, 222, 233],
        magenta: [180, 142, 173],
    },
    // Tokyo Night — cooler, neon-ish.
    'tokyo-night': {
        blue:    [122, 162, 247],
        orange:  [255, 158, 100],
        green:   [158, 206, 106],
        cyan:    [125, 207, 255],
        red:     [247, 118, 142],
        yellow:  [224, 175, 104],
        white:   [192, 202, 245],
        magenta: [187, 154, 247],
    },
    // Dracula — saturated purples/pinks.
    'dracula': {
        blue:    [139, 233, 253],
        orange:  [255, 184, 108],
        green:   [80, 250, 123],
        cyan:    [139, 233, 253],
        red:     [255, 85, 85],
        yellow:  [241, 250, 140],
        white:   [248, 248, 242],
        magenta: [189, 147, 249],
    },
    // Gruvbox — warm, paper-and-ink retro.
    'gruvbox': {
        blue:    [131, 165, 152],
        orange:  [254, 128, 25],
        green:   [152, 151, 26],
        cyan:    [104, 157, 106],
        red:     [204, 36, 29],
        yellow:  [215, 153, 33],
        white:   [235, 219, 178],
        magenta: [177, 98, 134],
    },
    // Catppuccin (mocha) — pastel.
    'catppuccin': {
        blue:    [137, 180, 250],
        orange:  [250, 179, 135],
        green:   [166, 227, 161],
        cyan:    [137, 220, 235],
        red:     [243, 139, 168],
        yellow:  [249, 226, 175],
        white:   [205, 214, 244],
        magenta: [203, 166, 247],
    },
    // Solarized (dark) — classic balanced scheme.
    'solarized': {
        blue:    [38, 139, 210],
        orange:  [203, 75, 22],
        green:   [133, 153, 0],
        cyan:    [42, 161, 152],
        red:     [220, 50, 47],
        yellow:  [181, 137, 0],
        white:   [238, 232, 213],
        magenta: [211, 54, 130],
    },
    // Monochrome — no hue, just brightness. Useful on colorblind setups
    // or when the statusline should be visually quiet.
    'monochrome': {
        blue:    [190, 190, 190],
        orange:  [210, 210, 210],
        green:   [230, 230, 230],
        cyan:    [200, 200, 200],
        red:     [245, 245, 245],
        yellow:  [225, 225, 225],
        white:   [250, 250, 250],
        magenta: [175, 175, 175],
    },
});

export const PALETTE_NAMES = Object.keys(PALETTES);

export function makePalette(enabled, paletteName = 'default') {
    if (!enabled) {
        return {
            blue: noColor, orange: noColor, green: noColor, cyan: noColor,
            red: noColor, yellow: noColor, white: noColor, magenta: noColor,
            dim: noColor, reset: '', clr: '',
        };
    }
    const spec = PALETTES[paletteName] ?? PALETTES.default;
    return {
        blue:    rgb(...spec.blue),
        orange:  rgb(...spec.orange),
        green:   rgb(...spec.green),
        cyan:    rgb(...spec.cyan),
        red:     rgb(...spec.red),
        yellow:  rgb(...spec.yellow),
        white:   rgb(...spec.white),
        magenta: rgb(...spec.magenta),
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
    rail: '-',
};

// Bar styles — swap the bar glyphs independently of the icon set.
//   dots     (default): ●/○ — readable, balanced
//   blocks   : █/░ — denser, reads like a progress bar
//   braille  : ⣿/⣀ — ultra-compact, tightly packed
//   ascii    : #/- — portable fallback (same as ICONS_ASCII.barFilled/barEmpty)
//   hearts   : ♥/♡ — playful; unambiguous fill state
//   arrows   : ▰/▱ — mid-density rectangles, popular in p10k-style bars
const BAR_STYLES = Object.freeze({
    dots:    { barFilled: '●', barEmpty: '○', rail: '─' },
    blocks:  { barFilled: '█', barEmpty: '░', rail: '░' },
    braille: { barFilled: '⣿', barEmpty: '⣀', rail: '⣀' },
    ascii:   { barFilled: '#', barEmpty: '-', rail: '-' },
    hearts:  { barFilled: '♥', barEmpty: '♡', rail: '·' },
    arrows:  { barFilled: '▰', barEmpty: '▱', rail: '·' },
});

export const BAR_STYLE_NAMES = Object.keys(BAR_STYLES);

// Merge a bar style onto an icon set. Kept as a free function rather than
// baked into pickIcons because pickIcons has independent fallback rules
// (ascii vs unicode) and BAR_STYLE_NAMES is user-visible enum in the wizard.
export function applyBarStyle(icons, styleName) {
    const style = BAR_STYLES[styleName];
    if (!style) return icons;
    return { ...icons, ...style };
}

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
