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
const PALETTES = Object.freeze({
    // The original lean-statusline palette. Punchy, bespoke (no upstream).
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
    // ── Dark palettes ──────────────────────────────────────────

    // Nord — muted arctic blues/greens.
    // Source: nordtheme.com/docs/colors-and-palettes. All slots canonical.
    'nord': {
        blue:    [129, 161, 193],   // nord9
        orange:  [208, 135, 112],   // nord12
        green:   [163, 190, 140],   // nord14
        cyan:    [136, 192, 208],   // nord8
        red:     [191, 97, 106],    // nord11
        yellow:  [235, 203, 139],   // nord13
        white:   [216, 222, 233],   // nord4
        magenta: [180, 142, 173],   // nord15
    },
    // Tokyo Night — folke/tokyonight.nvim Moon (v1.4.0 fix: was Storm).
    'tokyo-night': {
        blue:    [130, 170, 255],   // #82aaff
        orange:  [255, 150, 108],   // #ff966c
        green:   [195, 232, 141],   // #c3e88d
        cyan:    [134, 225, 252],   // #86e1fc
        red:     [255, 117, 127],   // #ff757f
        yellow:  [255, 199, 119],   // #ffc777
        white:   [200, 211, 245],   // #c8d3f5
        magenta: [192, 153, 255],   // #c099ff
    },
    // Tokyo Night Storm — original values preserved under their correct label.
    'tokyo-night-storm': {
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
    // Source: draculatheme.com/spec. v1.4.0 fix: `blue` was cyan, `magenta` was blue.
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
    // Gruvbox — warm, paper-and-ink retro.
    // Source: morhetz/gruvbox. v1.4.0: now all `bright_*` tier (was mixed).
    'gruvbox': {
        blue:    [131, 165, 152],   // #83a598 bright
        orange:  [254, 128, 25],    // #fe8019 bright
        green:   [184, 187, 38],    // #b8bb26 bright
        cyan:    [142, 192, 124],   // #8ec07c bright
        red:     [251, 73, 52],     // #fb4934 bright
        yellow:  [250, 189, 47],    // #fabd2f bright
        white:   [235, 219, 178],   // #ebdbb2 light1
        magenta: [211, 134, 155],   // #d3869b bright
    },
    // Catppuccin Mocha — the darkest of the Catppuccin family.
    // Source: catppuccin/palette (palette.json). Canonical.
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
    'catppuccin-frappe': {
        blue:    [140, 170, 238],   // #8caaee
        orange:  [239, 159, 118],   // #ef9f76
        green:   [166, 209, 137],   // #a6d189
        cyan:    [153, 209, 219],   // #99d1db
        red:     [231, 130, 132],   // #e78284
        yellow:  [229, 200, 144],   // #e5c890
        white:   [198, 208, 245],   // #c6d0f5
        magenta: [202, 158, 230],   // #ca9ee6
    },
    'catppuccin-macchiato': {
        blue:    [138, 173, 244],   // #8aadf4
        orange:  [245, 169, 127],   // #f5a97f
        green:   [166, 218, 149],   // #a6da95
        cyan:    [145, 215, 227],   // #91d7e3
        red:     [237, 135, 150],   // #ed8796
        yellow:  [238, 212, 159],   // #eed49f
        white:   [202, 211, 245],   // #cad3f5
        magenta: [198, 160, 246],   // #c6a0f6
    },
    // Solarized (dark). v1.4.0 fix: `white` was base2 (light-theme bg); now base0.
    'solarized': {
        blue:    [38, 139, 210],    // #268bd2
        orange:  [203, 75, 22],     // #cb4b16
        green:   [133, 153, 0],     // #859900
        cyan:    [42, 161, 152],    // #2aa198
        red:     [220, 50, 47],     // #dc322f
        yellow:  [181, 137, 0],     // #b58900
        white:   [131, 148, 150],   // #839496 (base0, dark-theme fg)
        magenta: [211, 54, 130],    // #d33682
    },
    // Rose Pine — "soho vibes for programmers".
    // Source: github.com/rose-pine/palette. foam is shared across green+cyan,
    // gold across orange+yellow — faithful to the 6-accent theme design.
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
    'rose-pine-moon': {
        blue:    [62, 143, 176],    // #3e8fb0 (pine, slightly lighter)
        orange:  [246, 193, 119],   // #f6c177 (gold)
        green:   [156, 207, 216],   // #9ccfd8 (foam)
        cyan:    [156, 207, 216],   // #9ccfd8 (foam)
        red:     [235, 111, 146],   // #eb6f92 (love)
        yellow:  [246, 193, 119],   // #f6c177 (gold)
        white:   [224, 222, 244],   // #e0def4 (text)
        magenta: [196, 167, 231],   // #c4a7e7 (iris)
    },
    // Kanagawa — inspired by Katsushika Hokusai's "Great Wave".
    // Source: rebelot/kanagawa.nvim/lua/kanagawa/colors.lua.
    'kanagawa-wave': {
        blue:    [126, 156, 216],   // #7E9CD8 (crystalBlue)
        orange:  [255, 160, 102],   // #FFA066 (surimiOrange)
        green:   [152, 187, 108],   // #98BB6C (springGreen)
        cyan:    [127, 180, 202],   // #7FB4CA (springBlue)
        red:     [255, 93, 98],     // #FF5D62 (peachRed)
        yellow:  [230, 195, 132],   // #E6C384 (carpYellow)
        white:   [220, 215, 186],   // #DCD7BA (fujiWhite)
        magenta: [149, 127, 184],   // #957FB8 (oniViolet)
    },
    'kanagawa-dragon': {
        blue:    [139, 164, 176],   // #8ba4b0 (dragonBlue2)
        orange:  [182, 146, 123],   // #b6927b (dragonOrange)
        green:   [135, 169, 135],   // #87a987 (dragonGreen)
        cyan:    [142, 164, 162],   // #8ea4a2 (dragonAqua)
        red:     [196, 116, 110],   // #c4746e (dragonRed)
        yellow:  [196, 178, 138],   // #c4b28a (dragonYellow)
        white:   [197, 201, 197],   // #c5c9c5 (dragonWhite)
        magenta: [162, 146, 163],   // #a292a3 (dragonPink)
    },
    // Atom One Dark — the original GitHub editor theme.
    // Source: github.com/atom/one-dark-syntax.
    'one-dark': {
        blue:    [97, 175, 239],    // #61afef
        orange:  [209, 154, 102],   // #d19a66
        green:   [152, 195, 121],   // #98c379
        cyan:    [86, 182, 194],    // #56b6c2
        red:     [224, 108, 117],   // #e06c75
        yellow:  [229, 192, 123],   // #e5c07b
        white:   [171, 178, 191],   // #abb2bf
        magenta: [198, 120, 221],   // #c678dd
    },
    // Ayu — "simple theme with bright colors".
    // Source: ayu-theme/vscode-ayu (terminal.ansi* from ayu-{dark,mirage}.json).
    'ayu-dark': {
        blue:    [89, 194, 255],    // #59c2ff
        orange:  [255, 180, 84],    // #ffb454
        green:   [170, 217, 76],    // #aad94c
        cyan:    [149, 230, 203],   // #95e6cb
        red:     [240, 113, 120],   // #f07178
        yellow:  [230, 180, 80],    // #e6b450
        white:   [191, 189, 182],   // #bfbdb6
        magenta: [210, 166, 255],   // #d2a6ff
    },
    'ayu-mirage': {
        blue:    [115, 208, 255],   // #73d0ff
        orange:  [255, 205, 102],   // #ffcd66
        green:   [213, 255, 128],   // #d5ff80
        cyan:    [149, 230, 203],   // #95e6cb
        red:     [242, 135, 121],   // #f28779
        yellow:  [252, 202, 96],    // #fcca60
        white:   [204, 202, 194],   // #cccac2
        magenta: [223, 191, 255],   // #dfbfff
    },
    // Monochrome — dark-bg grayscale. See `mono-light` for light terminals.
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

    // ── Light palettes ─────────────────────────────────────────

    // Catppuccin Latte — the light variant of Catppuccin.
    'catppuccin-latte': {
        blue:    [30, 102, 245],    // #1e66f5
        orange:  [254, 100, 11],    // #fe640b (peach)
        green:   [64, 160, 43],     // #40a02b
        cyan:    [4, 165, 229],     // #04a5e5 (sky)
        red:     [210, 15, 57],     // #d20f39
        yellow:  [223, 142, 29],    // #df8e1d
        white:   [76, 79, 105],     // #4c4f69 (text — dark fg)
        magenta: [136, 57, 239],    // #8839ef (mauve)
    },
    // Rose Pine Dawn — the light variant of Rose Pine.
    'rose-pine-dawn': {
        blue:    [40, 105, 131],    // #286983 (pine)
        orange:  [234, 157, 52],    // #ea9d34 (gold)
        green:   [86, 148, 159],    // #56949f (foam)
        cyan:    [86, 148, 159],    // #56949f (foam)
        red:     [180, 99, 122],    // #b4637a (love)
        yellow:  [234, 157, 52],    // #ea9d34 (gold)
        white:   [87, 82, 121],     // #575279 (text — dark fg)
        magenta: [144, 122, 169],   // #907aa9 (iris)
    },
    // Ayu Light — the light variant of Ayu.
    'ayu-light': {
        blue:    [34, 164, 230],    // #22a4e6
        orange:  [235, 164, 0],     // #eba400
        green:   [134, 179, 0],     // #86b300
        cyan:    [76, 191, 153],    // #4cbf99
        red:     [240, 113, 113],   // #f07171
        yellow:  [231, 161, 0],     // #e7a100
        white:   [92, 97, 102],     // #5c6166 (text — dark fg)
        magenta: [163, 122, 204],   // #a37acc
    },
    // Solarized Light — same accents, different base.
    'solarized-light': {
        blue:    [38, 139, 210],    // #268bd2 (same accents as solarized-dark)
        orange:  [203, 75, 22],     // #cb4b16
        green:   [133, 153, 0],     // #859900
        cyan:    [42, 161, 152],    // #2aa198
        red:     [220, 50, 47],     // #dc322f
        yellow:  [181, 137, 0],     // #b58900
        white:   [101, 123, 131],   // #657b83 (base00, light-theme fg)
        magenta: [211, 54, 130],    // #d33682
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
//   dots     (default): ●/○ — readable, balanced
//   blocks   : █/░ — denser, reads like a progress bar
//   braille  : ⣿/⣀ — ultra-compact, tightly packed
//   ascii    : #/- — portable fallback (same as ICONS_ASCII.barFilled/barEmpty)
//   hearts   : ♥/♡ — playful; unambiguous fill state
//   arrows   : ▰/▱ — mid-density rectangles, popular in p10k-style bars
//   squares  : ■/□ — clean geometric
//   bricks   : ▓/░ — thick "loading bar" feel, two-tone
//   lines    : ━/─ — minimal, low-contrast; reads as a progress track
//   lanterns : ◉/○ — dot-in-ring; distinct from `dots` at high fill
//   triangles: ▲/△ — sharp, directional
const BAR_STYLES = Object.freeze({
    dots:      { barFilled: '●', barEmpty: '○', rail: '─' },
    blocks:    { barFilled: '█', barEmpty: '░', rail: '░' },
    braille:   { barFilled: '⣿', barEmpty: '⣀', rail: '⣀' },
    ascii:     { barFilled: '#', barEmpty: '-', rail: '-' },
    hearts:    { barFilled: '♥', barEmpty: '♡', rail: '·' },
    arrows:    { barFilled: '▰', barEmpty: '▱', rail: '·' },
    squares:   { barFilled: '■', barEmpty: '□', rail: '─' },
    bricks:    { barFilled: '▓', barEmpty: '░', rail: '░' },
    lines:     { barFilled: '━', barEmpty: '─', rail: '─' },
    lanterns:  { barFilled: '◉', barEmpty: '○', rail: '·' },
    triangles: { barFilled: '▲', barEmpty: '△', rail: '·' },
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
