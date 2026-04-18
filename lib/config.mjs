// Config: load, merge, write. Precedence: env > file > defaults.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { PALETTE_NAMES, BAR_STYLE_NAMES } from './colors.mjs';

export const CONFIG_PATH = join(homedir(), '.claude', 'lean-statusline.json');

// Enum options are declared once here so the wizard, validator and config
// consumers all agree on the allowed values. Add an option in one place.
export const ENUMS = Object.freeze({
    icons:        ['auto', 'unicode', 'ascii'],
    palette:      PALETTE_NAMES,
    barStyle:     BAR_STYLE_NAMES,
    spacing:      ['tight', 'normal', 'loose'],
    modelFormat:  ['full', 'short', 'code'],
    dirStyle:     ['smart', 'basename', 'tilde', 'full'],
    branchStyle:  ['paren', 'bracket', 'brace', 'bare'],
    hostnameStyle:['short', 'full'],
});

export const DEFAULTS = Object.freeze({
    // Default preset is `compact` — one header line + rate-bars on line 2.
    // Hits the sweet spot between minimal (no rate-limit visibility) and
    // full (three lines, heavier). `ssh` still leads so remote sessions
    // get the 🔒 <host> prefix for free.
    preset: 'compact',
    segments: ['ssh', 'model', 'ctx', 'dir', '\n', 'rate-5h-full', 'rate-7d-full'],
    show: {
        branch: true,
        dirty: true,
        zap: true,
        // bars: global toggle for *every* bar-producing segment — the ctx
        // inline bubbles, the compact 5h/7d inline bubbles, the `rate-*-full`
        // segment bars, and the wide `context-bar`. One switch hides them all.
        bars: true,
    },
    // Default changed from 'auto' in 1.1.0 — modern terminals overwhelmingly
    // render unicode correctly; pinning to 'unicode' avoids the old
    // allowlist-based detection silently falling back to ascii when
    // TERM_PROGRAM is absent. Users on legacy/SSH-tofu setups can pick
    // 'auto' or 'ascii' in the wizard.
    icons: 'unicode',     // 'auto' | 'unicode' | 'ascii'
    colors: true,
    separator: '·',
    // Spacing around separators: tight = "a·b", normal = "a · b", loose = "a  ·  b".
    spacing: 'normal',
    // Color scheme for the whole statusline. See PALETTES in lib/colors.mjs.
    palette: 'default',
    // Bar glyphs. dots is the classic ●○; blocks/braille/arrows/hearts/ascii
    // swap the filled/empty pair and the wide-bar rail.
    barStyle: 'dots',
    // Wide fuel-gauge (`context-bar` segment).
    contextBarWidth: 75,
    // Inline ctx bubbles. Doubled from the legacy 8-wide scale because ctx is
    // the busiest signal on the line — 20 slots show real movement per turn.
    ctxBarWidth: 20,
    // Compact-inline bar width used by `5h`/`7d` and by `rate-*-full`.
    rateBarWidth: 10,
    thresholds: { warn: 50, high: 70, crit: 90 },
    // How to display `model.display_name`:
    //   full  → "Opus 4.7 (1M context)"
    //   short → drop trailing "(…)"        → "Opus 4.7"
    //   code  → lowercase-hyphenated      → "opus-4-7"
    modelFormat: 'full',
    // How to display the current working directory:
    //   smart    → tilde form if ≤ dirMaxLen chars, else collapse to basename
    //   basename → last path component     → "lean-statusline"
    //   tilde    → replace $HOME with ~    → "~/dev/lean-statusline"
    //   full     → absolute path
    dirStyle: 'smart',
    // Character budget for the `smart` dir style. A tilde-form path at or
    // under this length renders in full; longer paths collapse to the
    // basename so the statusline stays readable. 30 fits `~/dev/<project>`
    // for most typical trees without bleeding into the rest of the line.
    dirMaxLen: 30,
    // Wrapper used around the branch name. `bare` drops brackets entirely.
    branchStyle: 'paren',
    // Max branch-name chars before truncation (0 = no limit). Long feature
    // branches like `feat/ABC-1234-some-long-description` blow the line.
    branchMaxLen: 0,
    // Number of decimals in the `$X.YZ` cost segment.
    costPrecision: 2,
    // Render lines/tokens as `1.2k` / `3.4M` instead of raw digits. Quieter.
    compactNumbers: false,
    // SSH hostname display — `short` drops `.local`/domain suffix.
    hostnameStyle: 'short',
    // refreshInterval: seconds. 0 = event-driven only (no timer).
    // Recommended 3–10 when using countdown/cost/elapsed segments
    // so idle sessions stay fresh. Upper bound chosen to match
    // the platform's own soft cap — higher ≈ statusline feels stale.
    refreshInterval: 0,
});

export const KNOWN_SEGMENTS = [
    'ssh',
    'model', 'ctx', 'dir', '5h', '7d',
    'rate-5h-full', 'rate-7d-full', 'context-bar', 'bypass-banner',
    'session', 'elapsed', 'effort',
    // spec-field segments — all silent when the underlying field is absent:
    'cost', 'lines', 'worktree', 'agent', 'vim',
    'session-name', 'output-style', 'overflow',
    '\n',
];

function deepMerge(base, override) {
    if (override === undefined || override === null) return base;
    if (typeof base !== 'object' || typeof override !== 'object' || Array.isArray(base)) return override;
    const out = { ...base };
    for (const k of Object.keys(override)) {
        out[k] = deepMerge(base[k], override[k]);
    }
    return out;
}

function defaultUserConfigPath(options = {}) {
    return join(options.homeDir || homedir(), '.claude', 'lean-statusline.json');
}

function resolveProjectDir(input = {}, options = {}) {
    return options.projectDir
        ?? input?.workspace?.project_dir
        ?? options.cwd
        ?? process.cwd();
}

export function resolveConfigSelection(input = {}, options = {}) {
    const env = options.env ?? process.env;
    const candidates = [];
    if (env.LEAN_STATUSLINE_CONFIG) {
        return {
            path: env.LEAN_STATUSLINE_CONFIG,
            source: 'env',
            candidates: [env.LEAN_STATUSLINE_CONFIG],
        };
    }

    const projectDir = resolveProjectDir(input, options);
    if (projectDir) {
        candidates.push(join(projectDir, '.claude', 'lean-statusline.json'));
        candidates.push(join(projectDir, 'lean-statusline.config.json'));
    }
    const userPath = defaultUserConfigPath(options);
    candidates.push(userPath);

    const hit = candidates.find(path => existsSync(path)) || userPath;
    let source = 'user-default';
    if (projectDir && hit === join(projectDir, '.claude', 'lean-statusline.json')) source = 'project-dot-claude';
    else if (projectDir && hit === join(projectDir, 'lean-statusline.config.json')) source = 'project-alt';
    else if (hit === userPath && existsSync(userPath)) source = 'user';

    return { path: hit, source, candidates };
}

export function resolveConfigPath(input = {}, options = {}) {
    return resolveConfigSelection(input, options).path;
}

export function loadConfig(input = {}, options = {}) {
    const { path, source, candidates } = resolveConfigSelection(input, options);
    let fileCfg = {};
    let warning = null;
    if (existsSync(path)) {
        try {
            fileCfg = JSON.parse(readFileSync(path, 'utf8'));
        } catch (err) {
            warning = `invalid config at ${path}: ${err.message}`;
        }
    }
    const merged = deepMerge(DEFAULTS, fileCfg);
    return { config: merged, path, warning, source, candidates };
}

export function saveConfig(cfg, path = CONFIG_PATH) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

export function validateConfig(cfg) {
    const errors = [];
    if (!Array.isArray(cfg.segments) || cfg.segments.length === 0) {
        errors.push('segments must be a non-empty array');
    } else {
        for (const s of cfg.segments) {
            if (s === '\n') continue;
            if (!KNOWN_SEGMENTS.includes(s)) errors.push(`unknown segment: ${s}`);
        }
    }
    // Every field that carries a closed set of allowed values is validated
    // from ENUMS — a single source of truth shared with the wizard.
    for (const [key, allowed] of Object.entries(ENUMS)) {
        const v = cfg[key];
        if (v == null) continue;  // absent field inherits default; not an error
        if (!allowed.includes(v)) {
            errors.push(`${key} must be one of: ${allowed.join('|')} — got: ${v}`);
        }
    }
    if (typeof cfg.separator !== 'string' || cfg.separator.length === 0) {
        errors.push('separator must be a non-empty string');
    }
    for (const k of ['warn', 'high', 'crit']) {
        const v = cfg.thresholds?.[k];
        if (typeof v !== 'number' || v < 0 || v > 100) errors.push(`thresholds.${k} must be 0-100`);
    }
    // Numeric bounds.
    const checkNum = (key, min, max) => {
        const v = cfg[key];
        if (v == null) return;
        if (typeof v !== 'number' || v < min || v > max) {
            errors.push(`${key} must be a number in [${min}, ${max}] — got: ${v}`);
        }
    };
    checkNum('contextBarWidth', 20, 200);
    checkNum('ctxBarWidth', 0, 60);
    checkNum('rateBarWidth', 0, 40);
    checkNum('branchMaxLen', 0, 80);
    checkNum('costPrecision', 0, 4);
    checkNum('dirMaxLen', 8, 120);
    return errors;
}

// LEAN_STATUSLINE_* env vars that can override the loaded config. Keeping
// this list explicit lets the hot path skip the whole clone+override dance
// when none are set (the common case — users configure via the wizard).
const ENV_OVERRIDE_KEYS = [
    'LEAN_STATUSLINE_SEGMENTS',
    'LEAN_STATUSLINE_ICONS',
    'LEAN_STATUSLINE_SEPARATOR',
    'LEAN_STATUSLINE_NO_COLOR',
    'LEAN_STATUSLINE_SHOW_BARS',
    'LEAN_STATUSLINE_SHOW_SESSION',
    'LEAN_STATUSLINE_SHOW_EFFORT',
    'NO_COLOR',
];

// Apply LEAN_STATUSLINE_* env overrides on top of loaded config.
export function applyEnvOverrides(cfg) {
    const e = process.env;
    // Fast path: skip the structuredClone entirely when no relevant env var
    // is set. loadConfig() already returns a fresh object so aliasing is safe.
    if (!ENV_OVERRIDE_KEYS.some(k => e[k] != null)) return cfg;

    const out = structuredClone(cfg);
    if (e.LEAN_STATUSLINE_SEGMENTS) {
        out.segments = e.LEAN_STATUSLINE_SEGMENTS.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (e.LEAN_STATUSLINE_ICONS) out.icons = e.LEAN_STATUSLINE_ICONS;
    if (e.LEAN_STATUSLINE_SEPARATOR) out.separator = e.LEAN_STATUSLINE_SEPARATOR;
    if (e.LEAN_STATUSLINE_NO_COLOR || e.NO_COLOR) out.colors = false;
    if (e.LEAN_STATUSLINE_SHOW_BARS === '1') out.show.bars = true;
    if (e.LEAN_STATUSLINE_SHOW_SESSION === '1' && !out.segments.includes('session')) {
        out.segments.push('session');
    }
    if (e.LEAN_STATUSLINE_SHOW_EFFORT === '1' && !out.segments.includes('effort')) {
        out.segments.push('effort');
    }
    return out;
}
