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
// Canonical-source audits live in `docs/research/palettes/*.md`.
// Hex values in this file were validated against upstream repos in
// the 1.4.0 rewrite; previous drift (dracula blue↔magenta swap,
// solarized `white=base2`, tokyo-night-Storm-under-Moon-label,
// gruvbox tier mixing) was corrected.
//
// To add a palette: append an entry. Wizard/picker enumerate
// automatically via PALETTE_NAMES.
// 1.5.0: reduced from 17 → 6 palettes after user UX pass. Dropped palettes
// (default, nord, tokyo-night*, kanagawa*, one-dark, gruvbox, ayu-*,
// solarized-light, rose-pine-moon/dawn, catppuccin-frappe/macchiato) still
// documented under docs/research/palettes/ — they can come back via
// `--experimental` later. Saved configs referencing dropped names are
// remapped in loadConfig (see PALETTE_ALIASES in lib/config.mjs).
const PALETTES = Object.freeze({
    // Solarized (dark) — classic balanced scheme, works on most terminals.
    // v1.4.0 fix: `white` is `base0=#839496` (dark-theme fg), was `base2`.
    'solarized': {
        blue:    [38, 139, 210],    // #268bd2
        orange:  [203, 75, 22],     // #cb4b16
        green:   [133, 153, 0],     // #859900
        cyan:    [42, 161, 152],    // #2aa198
        red:     [220, 50, 47],     // #dc322f
        yellow:  [181, 137, 0],     // #b58900
        white:   [131, 148, 150],   // #839496 (base0)
        magenta: [211, 54, 130],    // #d33682
    },
    // Rose Pine (main) — "soho vibes for programmers". MIT.
    // Source: github.com/rose-pine/palette.
    'rose-pine': {
        blue:    [49, 116, 143],    // #31748f (pine)
        orange:  [246, 193, 119],   // #f6c177 (gold)
        green:   [156, 207, 216],   // #9ccfd8 (foam)
        cyan:    [156, 207, 216],   // #9ccfd8 (foam)
        red:     [235, 111, 146],   // #eb6f92 (love)
        yellow:  [246, 193, 119],   // #f6c177 (gold)
        white:   [224, 222, 244],   // #e0def4 (text)
        magenta: [196, 167, 231],   // #c4a7e7 (iris)
    },
    // Catppuccin Mocha — dark pastel. MIT.
    // Source: catppuccin/palette.
    'catppuccin': {
        blue:    [137, 180, 250],   // #89b4fa
        orange:  [250, 179, 135],   // #fab387 (peach)
        green:   [166, 227, 161],   // #a6e3a1
        cyan:    [137, 220, 235],   // #89dceb (sky)
        red:     [243, 139, 168],   // #f38ba8
        yellow:  [249, 226, 175],   // #f9e2af
        white:   [205, 214, 244],   // #cdd6f4 (text)
        magenta: [203, 166, 247],   // #cba6f7 (mauve)
    },
    // Catppuccin Latte — light variant. The only light palette in 1.5.0.
    'catppuccin-latte': {
        blue:    [30, 102, 245],    // #1e66f5
        orange:  [254, 100, 11],    // #fe640b (peach)
        green:   [64, 160, 43],     // #40a02b
        cyan:    [4, 165, 229],     // #04a5e5 (sky)
        red:     [210, 15, 57],     // #d20f39
        yellow:  [223, 142, 29],    // #df8e1d
        white:   [76, 79, 105],     // #4c4f69 (text — dark fg for light bg)
        magenta: [136, 57, 239],    // #8839ef (mauve)
    },
    // Dracula — saturated purples/pinks. MIT.
    // Source: draculatheme.com/spec. v1.4.0 fix: blue/magenta swap.
    'dracula': {
        blue:    [189, 147, 249],   // #bd93f9 (Dracula "purple")
        orange:  [255, 184, 108],   // #ffb86c
        green:   [80, 250, 123],    // #50fa7b
        cyan:    [139, 233, 253],   // #8be9fd
        red:     [255, 85, 85],     // #ff5555
        yellow:  [241, 250, 140],   // #f1fa8c
        white:   [248, 248, 242],   // #f8f8f2
        magenta: [255, 121, 198],   // #ff79c6 (Dracula "pink")
    },
    // Monochrome — grayscale ramp for dark bg. Colorblind-friendly,
    // semantic hues collapse to brightness differences only.
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
    const warnAt = thresholds?.warn_at ?? thresholds?.high ?? thresholds?.warn ?? 70;
    const critAt = thresholds?.critical_at ?? thresholds?.crit ?? 90;
    if (pct >= critAt) return palette.red;
    if (pct >= warnAt) return palette.yellow;
    return palette.green;
}

// Icon fallback policy:
//   "ascii"   → always ASCII
//   "unicode" → always unicode
//   "nerd"    → Nerd Font glyphs (explicit opt-in). Nerd Font availability
//              can't be reliably detected from a spawned shell — the Nerd
//              Fonts maintainers themselves recommend against auto-probing
//              (see docs/research/nerd-fonts/02-detection-infeasibility.md).
//              Only honored when the user explicitly sets this mode.
//   "auto"    → unicode unless we have concrete evidence the terminal
//              can't render it. Modern terminals overwhelmingly do —
//              the 2020-era "allowlist of known-modern TERM_PROGRAMs"
//              turned into a liability: TERM_PROGRAM is frequently
//              unset (including when Claude Code spawns the statusline
//              in some configurations), so the allowlist was defaulting
//              to ascii even in a Ghostty/iTerm/WezTerm session.
//
//   Signals considered (auto):
//     - TERM=dumb|linux|'' → ascii (genuine low-capability envs)
//     - SSH + no UTF-8 locale → ascii (remote tofu-box risk)
//     - otherwise → unicode
export function pickIcons(mode) {
    // Env override takes precedence so users can opt into nerd mode without
    // editing their config file (useful when SSHing into boxes that have
    // different font setups).
    const envIcons = process.env.LEAN_STATUSLINE_ICONS;
    if (envIcons === 'nerd')    return ICONS_NERD;
    if (envIcons === 'unicode') return ICONS_UNICODE;
    if (envIcons === 'ascii')   return ICONS_ASCII;

    if (mode === 'nerd')    return ICONS_NERD;
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
    // Subagent status glyphs (lean-statusline-subagents bin).
    running: '●',
    done: '✓',
    error: '✗',
    paused: '⏸',
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
    // Subagent status glyphs (lean-statusline-subagents bin).
    running: '*',
    done: 'v',
    error: 'x',
    paused: '=',
};

// Nerd Font — opt-in only. Users need a patched font on the active
// terminal ("Symbols Nerd Font Mono" as fallback is enough — no need to
// replace the primary font; see docs/research/nerd-fonts/00-findings.md).
// Codepoints verified against nerdfonts.com/cheat-sheet + the
// 8bitmcu/NerdFont-Cheat-Sheet CSV mirror on 2026-04-21. Stable since v3.0.x.
//
// Shapes that Unicode renders fine in the average terminal (bypass arrows,
// effort circles, rail) stay on Unicode to avoid forcing a font switch for
// a non-improvement.
const ICONS_NERD = {
    ctx:      '\u{F03EB}',   // nf-md-pencil
    timer:    '\u{F0954}',   // nf-md-clock
    zap:      '\u{F0E7}',    // nf-fa-bolt
    refresh:  '\u{F0450}',   // nf-md-refresh
    bypass:   '▶▶',          // no clean NF equivalent — keep Unicode
    ssh:      '\u{F033E}',   // nf-md-lock
    money:    '\u{F155}',    // nf-fa-dollar-sign
    worktree: '\u{E725}',    // nf-dev-git-branch
    agent:    '\u{F06A9}',   // nf-md-robot
    warn:     '\u{F071}',    // nf-fa-warning
    effortHigh: '●',         // Unicode renders fine in any terminal
    effortMed:  '◐',
    effortLow:  '◔',
    barFilled: '\u{F111}',   // nf-fa-circle
    barEmpty:  '\u{F10C}',   // nf-fa-circle-o
    rail:      '─',
    running:   '\u{F144}',   // nf-fa-play-circle
    done:      '\u{F00C}',   // nf-fa-check
    error:     '\u{F00D}',   // nf-fa-times
    paused:    '\u{F04C}',   // nf-fa-pause
};

// Bar styles — swap the bar glyphs independently of the icon set.
// 1.5.0 reduced the set from 11 → 7 and reordered so `lanterns` is second
// (the user flagged it as their favourite). The dropped styles (braille,
// hearts, arrows, triangles) fall back to `dots` via BAR_STYLE_ALIASES in
// lib/config.mjs so old configs still load.
//
//   dots     (default): ●/○ — readable, balanced
//   lanterns          : ◉/○ — dot-in-ring; distinct from dots at high fill
//   blocks            : █/░ — denser, reads like a progress bar
//   ascii             : #/- — portable fallback
//   squares           : ■/□ — clean geometric
//   bricks            : ▓/░ — thick "loading bar" feel, two-tone
//   lines             : ━/─ — minimal, reads as a progress track
const BAR_STYLES = Object.freeze({
    dots:     { barFilled: '●', barEmpty: '○', rail: '─' },
    lanterns: { barFilled: '◉', barEmpty: '○', rail: '·' },
    blocks:   { barFilled: '█', barEmpty: '░', rail: '░' },
    ascii:    { barFilled: '#', barEmpty: '-', rail: '-' },
    squares:  { barFilled: '■', barEmpty: '□', rail: '─' },
    bricks:   { barFilled: '▓', barEmpty: '░', rail: '░' },
    lines:    { barFilled: '━', barEmpty: '─', rail: '─' },
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
