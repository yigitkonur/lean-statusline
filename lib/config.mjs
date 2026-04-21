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

const LEGACY_THRESHOLD_WARNING = 'thresholds.warn/high/crit are deprecated; use thresholds.warn_at/critical_at';

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
        projectDirCrumb: true,
        worktree: true,
        paceDelta: true,
        subagents: true,
        // bars: global toggle for *every* bar-producing segment — the ctx
        // inline bubbles, the compact 5h/7d inline bubbles, the `rate-*-full`
        // segment bars, and the wide `context-bar`. One switch hides them all.
        bars: true,
        // Cumulative token badge (Nk) appended to the right of context-bar.
        contextTokens: true,
        // CC update-available notice in context-bar when a newer version is on npm.
        ccUpdate: true,
    },
    conditionals: {
        agent: {
            requires: ['agent.name'],
            hide_when_equals: {
                'agent.name': ['default', 'claude'],
            },
        },
        cost: {
            hide_when_equals: {
                'cost.total_cost_usd': [0, null],
            },
        },
        lines: {
            hide_when_equals_all: {
                'cost.total_lines_added': [0, null],
                'cost.total_lines_removed': [0, null],
            },
        },
    },
    pace: {
        fastBand: 5,
        slowBand: -5,
        suppressBelow: 2,
        // Default display for the 5h row: ETA inline (`vs est: 2h11m`) when burn
        // pace will exhaust the quota before reset. 'delta' keeps the legacy
        // ⇡+N arrow; 'off' hides the pace indicator entirely. 7d always uses delta.
        mode: 'eta',             // 'eta' | 'delta' | 'off'
        // ms thresholds for ETA color grading (5h-only, when mode='eta')
        etaCriticalMs: 3_600_000,   // < 1h → red
        etaWarnMs: 14_400_000,      // < 4h → orange, else orange (upper bound kept for clarity)
        // Explainer row — teaches what `vs est:` means. Appears for 10s when
        // urgency activates, re-appears every 10 min while urgency persists
        // with adaptive copy (first / steady / faster / slower).
        explainer: true,
        explainerDurationMs: 10_000,
        explainerIntervalMs: 600_000,
        explainerTrendThresholdMs: 60_000,
    },
    subagents: {
        showNames: false,
        maxNames: 3,
        dimThreshold: 1,
        boldThreshold: 3,
    },
    transcript: {
        enabled: false,
        maxFirstReadMs: 500,
        reducers: ['lastTool', 'failStreak', 'subagents', 'cacheRatio'],
    },
    layout: {
        tiers: { xl: 150, l: 100, m: 76, s: 0 },
        dropOrder: ['ccUpdate', 'contextTokens', '7d.bar', '7d.countdown', 'paceDelta', '7d.label', '7d.percent', '5h.countdown', '5h.pace', 'projectDirCrumb', 'lines', 'cost'],
        forceMinWidth: null,
    },
    rateLimit: {
        collapseMinutes: 5,
        hysteresisSeconds: 30,
        collapseColor: 'green',
        countdownUnits: 'auto',
        collapseGlyph: '↻',
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
    // DEPRECATED: legacy inline `ctx` bubble-bar width. The ctx segment was
    // simplified to text-only (color-graded `pct%`) in favor of the full-width
    // `context-bar` row, so this knob is a no-op. Kept in DEFAULTS + validated
    // range so existing saved configs don't error; removed from the wizard.
    ctxBarWidth: 20,
    // Compact-inline bar width used by `5h`/`7d` and by `rate-*-full`.
    rateBarWidth: 10,
    thresholds: { warn_at: 70, critical_at: 90 },
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
    'rate-5h-full', 'rate-7d-full', 'context-bar', 'pace-explainer', 'bypass-banner',
    'session', 'elapsed', 'effort',
    // spec-field segments — all silent when the underlying field is absent:
    'cost', 'lines', 'worktree', 'agent', 'subagents', 'vim',
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

function normalizeThresholds(thresholds) {
    if (thresholds == null || typeof thresholds !== 'object' || Array.isArray(thresholds)) {
        return { thresholds, warnings: [] };
    }

    const hasLegacy = ['warn', 'high', 'crit'].some(key => Object.hasOwn(thresholds, key));
    if (!hasLegacy) return { thresholds, warnings: [] };

    const normalized = {};
    const warnAt = thresholds.warn_at ?? thresholds.high ?? thresholds.warn;
    const criticalAt = thresholds.critical_at ?? thresholds.crit;
    if (warnAt != null) normalized.warn_at = warnAt;
    if (criticalAt != null) normalized.critical_at = criticalAt;
    return {
        thresholds: normalized,
        warnings: [LEGACY_THRESHOLD_WARNING],
    };
}

function normalizeConfig(cfg) {
    if (cfg == null || typeof cfg !== 'object' || Array.isArray(cfg)) {
        return { config: cfg, warnings: [] };
    }

    const normalized = structuredClone(cfg);
    const warnings = [];
    if (normalized.thresholds != null) {
        const next = normalizeThresholds(normalized.thresholds);
        normalized.thresholds = next.thresholds;
        warnings.push(...next.warnings);
    }
    return { config: normalized, warnings };
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
    let warnings = [];
    if (existsSync(path)) {
        try {
            const raw = JSON.parse(readFileSync(path, 'utf8'));
            const normalized = normalizeConfig(raw);
            fileCfg = normalized.config;
            warnings = normalized.warnings;
        } catch (err) {
            warning = `invalid config at ${path}: ${err.message}`;
        }
    }
    const merged = deepMerge(DEFAULTS, fileCfg);
    return { config: merged, path, warning, warnings, source, candidates };
}

export function saveConfig(cfg, path = CONFIG_PATH) {
    mkdirSync(dirname(path), { recursive: true });
    const normalized = normalizeConfig(cfg).config;
    writeFileSync(path, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
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
    if (cfg.thresholds != null) {
        if (typeof cfg.thresholds !== 'object' || Array.isArray(cfg.thresholds)) {
            errors.push('thresholds must be an object');
        } else {
            const warnAt = cfg.thresholds.warn_at ?? cfg.thresholds.high ?? cfg.thresholds.warn ?? DEFAULTS.thresholds.warn_at;
            const criticalAt = cfg.thresholds.critical_at ?? cfg.thresholds.crit ?? DEFAULTS.thresholds.critical_at;
            for (const [key, value] of [['warn_at', warnAt], ['critical_at', criticalAt]]) {
                if (typeof value !== 'number' || value < 0 || value > 100) {
                    errors.push(`thresholds.${key} must be 0-100`);
                }
            }
            if (typeof warnAt === 'number' && typeof criticalAt === 'number' && warnAt >= criticalAt) {
                errors.push('thresholds.warn_at must be < thresholds.critical_at');
            }
        }
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

    if (cfg.pace != null) {
        if (typeof cfg.pace !== 'object' || Array.isArray(cfg.pace)) {
            errors.push('pace must be an object');
        } else {
            const checkPaceNum = (key, min, max) => {
                const value = cfg.pace?.[key];
                if (value == null) return;
                if (typeof value !== 'number' || value < min || value > max) {
                    errors.push(`pace.${key} must be a number in [${min}, ${max}] — got: ${value}`);
                }
            };
            checkPaceNum('fastBand', 0, 100);
            checkPaceNum('slowBand', -100, 0);
            checkPaceNum('suppressBelow', 0, 100);
            const PACE_MODES = ['eta', 'delta', 'off'];
            if (cfg.pace.mode != null && !PACE_MODES.includes(cfg.pace.mode)) {
                errors.push(`pace.mode must be one of ${PACE_MODES.join(', ')} — got: ${cfg.pace.mode}`);
            }
            for (const key of ['etaCriticalMs', 'etaWarnMs', 'explainerDurationMs', 'explainerIntervalMs', 'explainerTrendThresholdMs']) {
                const v = cfg.pace[key];
                if (v == null) continue;
                if (!Number.isFinite(v) || v < 0) {
                    errors.push(`pace.${key} must be a non-negative number — got: ${v}`);
                }
            }
            if (cfg.pace.explainer != null && typeof cfg.pace.explainer !== 'boolean') {
                errors.push(`pace.explainer must be a boolean — got: ${cfg.pace.explainer}`);
            }
        }
    }

    if (cfg.transcript != null) {
        if (typeof cfg.transcript !== 'object' || Array.isArray(cfg.transcript)) {
            errors.push('transcript must be an object');
        } else {
            if (cfg.transcript.enabled != null && typeof cfg.transcript.enabled !== 'boolean') {
                errors.push('transcript.enabled must be a boolean');
            }
            if (cfg.transcript.maxFirstReadMs != null
                && (!Number.isFinite(cfg.transcript.maxFirstReadMs) || cfg.transcript.maxFirstReadMs < 0 || cfg.transcript.maxFirstReadMs > 5000)) {
                errors.push(`transcript.maxFirstReadMs must be a number in [0, 5000] — got: ${cfg.transcript.maxFirstReadMs}`);
            }
            if (cfg.transcript.reducers != null
                && (!Array.isArray(cfg.transcript.reducers) || cfg.transcript.reducers.some(v => typeof v !== 'string'))) {
                errors.push('transcript.reducers must be an array of strings');
            }
        }
    }

    if (cfg.subagents != null) {
        if (typeof cfg.subagents !== 'object' || Array.isArray(cfg.subagents)) {
            errors.push('subagents must be an object');
        } else {
            if (cfg.subagents.showNames != null && typeof cfg.subagents.showNames !== 'boolean') {
                errors.push('subagents.showNames must be a boolean');
            }
            for (const key of ['maxNames', 'dimThreshold', 'boldThreshold']) {
                const value = cfg.subagents[key];
                if (value != null && (!Number.isInteger(value) || value < 0 || value > 99)) {
                    errors.push(`subagents.${key} must be an integer in [0, 99] — got: ${value}`);
                }
            }
        }
    }

    if (cfg.layout != null) {
        if (typeof cfg.layout !== 'object' || Array.isArray(cfg.layout)) {
            errors.push('layout must be an object');
        } else {
            if (cfg.layout.forceMinWidth != null && (!Number.isFinite(cfg.layout.forceMinWidth) || cfg.layout.forceMinWidth < 0 || cfg.layout.forceMinWidth > 1000)) {
                errors.push(`layout.forceMinWidth must be a number in [0, 1000] — got: ${cfg.layout.forceMinWidth}`);
            }
            if (cfg.layout.dropOrder != null && (!Array.isArray(cfg.layout.dropOrder) || cfg.layout.dropOrder.some(v => typeof v !== 'string'))) {
                errors.push('layout.dropOrder must be an array of strings');
            }
            if (cfg.layout.tiers != null) {
                if (typeof cfg.layout.tiers !== 'object' || Array.isArray(cfg.layout.tiers)) {
                    errors.push('layout.tiers must be an object');
                } else {
                    for (const key of ['xl', 'l', 'm', 's']) {
                        const value = cfg.layout.tiers[key];
                        if (value != null && (!Number.isFinite(value) || value < 0 || value > 1000)) {
                            errors.push(`layout.tiers.${key} must be a number in [0, 1000] — got: ${value}`);
                        }
                    }
                }
            }
        }
    }

    if (cfg.rateLimit != null) {
        if (typeof cfg.rateLimit !== 'object' || Array.isArray(cfg.rateLimit)) {
            errors.push('rateLimit must be an object');
        } else {
            const checkRateNum = (key, min, max) => {
                const value = cfg.rateLimit?.[key];
                if (value == null) return;
                if (typeof value !== 'number' || value < min || value > max) {
                    errors.push(`rateLimit.${key} must be a number in [${min}, ${max}] — got: ${value}`);
                }
            };
            checkRateNum('collapseMinutes', 0, 120);
            checkRateNum('hysteresisSeconds', 0, 300);
            if (cfg.rateLimit.collapseColor != null && typeof cfg.rateLimit.collapseColor !== 'string') {
                errors.push('rateLimit.collapseColor must be a string');
            }
            if (cfg.rateLimit.countdownUnits != null && typeof cfg.rateLimit.countdownUnits !== 'string') {
                errors.push('rateLimit.countdownUnits must be a string');
            }
            if (cfg.rateLimit.collapseGlyph != null && typeof cfg.rateLimit.collapseGlyph !== 'string') {
                errors.push('rateLimit.collapseGlyph must be a string');
            }
        }
    }

    if (cfg.conditionals != null) {
        if (typeof cfg.conditionals !== 'object' || Array.isArray(cfg.conditionals)) {
            errors.push('conditionals must be an object');
        } else {
            for (const [segment, rules] of Object.entries(cfg.conditionals)) {
                if (!KNOWN_SEGMENTS.includes(segment)) {
                    errors.push(`conditionals.${segment} references an unknown segment`);
                    continue;
                }
                if (typeof rules !== 'object' || rules == null || Array.isArray(rules)) {
                    errors.push(`conditionals.${segment} must be an object`);
                    continue;
                }
                if (rules.requires != null && (!Array.isArray(rules.requires) || rules.requires.some(v => typeof v !== 'string'))) {
                    errors.push(`conditionals.${segment}.requires must be an array of strings`);
                }
                for (const key of ['hide_when_equals', 'hide_when_equals_all']) {
                    const value = rules[key];
                    if (value == null) continue;
                    if (typeof value !== 'object' || Array.isArray(value)) {
                        errors.push(`conditionals.${segment}.${key} must be an object`);
                        continue;
                    }
                    for (const [path, accepted] of Object.entries(value)) {
                        if (typeof path !== 'string' || !Array.isArray(accepted)) {
                            errors.push(`conditionals.${segment}.${key} must map field paths to arrays`);
                        }
                    }
                }
                if (rules.threshold != null) {
                    if (typeof rules.threshold !== 'object' || Array.isArray(rules.threshold)) {
                        errors.push(`conditionals.${segment}.threshold must be an object`);
                    } else {
                        for (const key of ['warn_at', 'critical_at', 'hide_below']) {
                            const value = rules.threshold[key];
                            if (value == null) continue;
                            if (typeof value !== 'number' || value < 0 || value > 100) {
                                errors.push(`conditionals.${segment}.threshold.${key} must be 0-100`);
                            }
                        }
                        if (rules.threshold.metric != null && typeof rules.threshold.metric !== 'string') {
                            errors.push(`conditionals.${segment}.threshold.metric must be a string`);
                        }
                    }
                }
                if (rules.max_messages != null && (!Number.isInteger(rules.max_messages) || rules.max_messages < 0)) {
                    errors.push(`conditionals.${segment}.max_messages must be a non-negative integer`);
                }
                if (rules.max_messages != null && typeof rules.max_messages_track !== 'string') {
                    errors.push(`conditionals.${segment}.max_messages_track must be set when max_messages is used`);
                }
                if (rules.detect_files != null && (!Array.isArray(rules.detect_files) || rules.detect_files.some(v => typeof v !== 'string'))) {
                    errors.push(`conditionals.${segment}.detect_files must be an array of strings`);
                }
                if (rules.cache != null) {
                    if (typeof rules.cache !== 'object' || Array.isArray(rules.cache)) {
                        errors.push(`conditionals.${segment}.cache must be an object`);
                    } else {
                        for (const key of ['ttl_ok', 'ttl_fail']) {
                            const value = rules.cache[key];
                            if (value != null && (!Number.isFinite(value) || value < 0)) {
                                errors.push(`conditionals.${segment}.cache.${key} must be a non-negative number`);
                            }
                        }
                    }
                }
            }
        }
    }
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
    'LEAN_STATUSLINE_NO_TRANSCRIPT',
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
    if (e.LEAN_STATUSLINE_NO_TRANSCRIPT === '1' || e.LEAN_STATUSLINE_NO_TRANSCRIPT === 'true') {
        out.transcript = { ...out.transcript, enabled: false };
    }
    return out;
}
