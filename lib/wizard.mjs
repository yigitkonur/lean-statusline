// Interactive TUI configurator for lean-statusline.
//
// Design brief:
//   - arrow-key navigation, not letter-pick
//   - live preview updates on every keystroke (no commit-then-see-result)
//   - schema-driven form so new fields are one-line additions (extensibility)
//   - zero deps — all raw ANSI, plain node stdin
//
// Layout (full-screen, redrawn every keystroke):
//   ┌─────────────────────────────────────────────────────┐
//   │ lean-statusline · configure            q·quit s·save│
//   │─────────────────────────────────────────────────────│
//   │   <live preview — rerenders per keystroke>          │
//   │─────────────────────────────────────────────────────│
//   │   preset      ‹ full  ›                             │
//   │   colors      [✓] on                                │
//   │   ...                                               │
//   │─────────────────────────────────────────────────────│
//   │  ↑↓ move · ←→ change · space toggle · s save        │
//   └─────────────────────────────────────────────────────┘
//
// Key bindings:
//   ↑/↓        navigate fields (skips section headers)
//   ←/→        cycle enum / adjust number / toggle bool
//   space      toggle bool/segment; same as → elsewhere
//   enter      same as →
//   tab        jump to next section
//   s          save + exit
//   r          reset to saved config (discard changes)
//   q / esc    quit without saving
//   Ctrl-C     quit (exit code 130)
//
// Terminal requirements: tty on stdin+stdout. ≥ 28 rows recommended;
// smaller terminals still work but preview may scroll.

import { makePalette, pickIcons, colorsEnabled, applyBarStyle, buildBar, colorForPct } from './colors.mjs';
import { PRESETS, PRESET_NAMES, applyPreset, resolvePresetAlias } from './presets.mjs';
import { DEFAULTS, ENUMS, loadConfig, saveConfig, validateConfig, KNOWN_SEGMENTS } from './config.mjs';
import { renderLine, detectDangerousPerms, resolveEffortLevel, readContextPct } from './segments.mjs';
import { applyLayout } from './layout.mjs';
import {
    CLEAR, HIDE_CUR, SHOW_CUR, BOLD, DIM, RESET,
    C_GREEN, C_CYAN, C_RED,
    HR, stripAnsi, enterRawMode, readKey,
} from './tui.mjs';

// ── Sample payload for the preview ──────────────────────
// Every silent-when-absent segment gets a fake value here so toggling it in
// the wizard produces a visible change in the preview. Real renders still
// return null when CC doesn't send the underlying field — the wizard is the
// only place these mock values are used.
const SAMPLE_INPUT = {
    model: { display_name: 'Opus 4.7 (1M context)' },
    cwd: process.cwd(),
    workspace: { current_dir: process.cwd() },
    context_window: {
        context_window_size: 1_000_000,
        used_percentage: 32,
        current_usage: { input_tokens: 320_000 },
    },
    cost: {
        total_cost_usd: 0.23,
        total_duration_ms: 2_712_000,
        total_lines_added: 156,
        total_lines_removed: 23,
    },
    session_id: 'wizard-preview',
    // Silent-when-absent segments — mock a realistic value so the user can
    // see the difference between ON and OFF while configuring.
    agent: { name: 'reviewer' },
    vim: { mode: 'NORMAL' },
    session_name: 'mypr-3',
    output_style: { name: 'explanatory' },  // non-'default' so output-style actually renders
    worktree: { name: 'feat-branch', original_branch: 'main' },
    exceeds_200k_tokens: true,              // triggers overflow badge
    subagents: [
        { id: 's1', name: 'code-reviewer', status: 'running' },
        { id: 's2', name: 'test-writer',   status: 'running' },
    ],
    effortLevel: 'high',                    // forces effort segment to render
    rate_limits: {
        five_hour: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 91 * 60 },
        seven_day: { used_percentage: 47, resets_at: Math.floor(Date.now() / 1000) + (5 * 24 + 7) * 3600 },
    },
};

// The preview's rateLimits pre-packed in the shape segments.mjs expects.
const SAMPLE_CTX_RATES = {
    fiveHour: { pct: 40, resetsAt: Date.now() + 91 * 60 * 1000 },
    sevenDay: { pct: 47, resetsAt: Date.now() + (5 * 24 + 7) * 3600 * 1000 },
    source: 'wizard',
};

// ── Form schema ─────────────────────────────────────────
// `kind` semantics:
//   header   — section separator, non-focusable
//   enum     — left/right/space cycles options[]
//   bool     — space/left/right flips
//   number   — left/right ±step, clamped to [min,max]
//   segment  — bool stored as membership in state.segments[]
// Stepped-page decomposition. Each entry has `page: 1..TOTAL_PAGES`. The
// wizard renders only entries whose page matches the current page, so the
// configurator fits comfortably on screens as short as 24 rows.
const TOTAL_PAGES = 5;
const PAGE_TITLES = {
    1: 'preset',
    2: 'layout',
    3: 'appearance',
    4: 'core segments',
    5: 'optional features',
};

// Core segments are "always relevant" — ssh indicator, ctx %, dir, rate
// bars, context bar, pace alerts. 5h/7d compact forms omitted (aliases of
// rate-*-full, see lib/segments.mjs SEGMENT_ALIASES). `bypass-banner` moved
// to optional — CC 2.x renders its own chrome so ours is rarely wanted.
const CORE_SEGMENTS = Object.freeze([
    'ssh', 'model', 'ctx', 'dir',
    'rate-5h-full', 'rate-7d-full', 'context-bar', 'pace-explainer',
]);
// Optional segments — default-off, user opts in on step 5. `agent`,
// `subagents`, `effort`, `elapsed`, `overflow` are default-on in the `full`
// preset but still exposed here so users can turn them off.
const OPTIONAL_SEGMENTS = Object.freeze([
    'effort', 'elapsed',
    'agent', 'subagents', 'overflow',
    'cost', 'lines', 'worktree', 'vim',
    'session-name', 'output-style', 'bypass-banner',
]);

// 1.5.0: re-introduced for ctx + pace-explainer. User specifically asked that
// the "your limit exhausts in X min" warning (pace-explainer) not be toggleable
// under any condition — it's the most important signal the statusline shows.
// ctx is the header % that should always be visible; users pick the label
// style (icon / text / none) via show.ctxLabel instead of toggling the segment.
const LOCKED_SEGMENTS = new Set(['ctx', 'pace-explainer']);

// Segments that are silent-when-absent-in-real-CC. When any of these is in
// state.segments, the wizard adds a footer note to the preview block so
// users don't wonder why the segment they just enabled isn't visible.
const CONDITIONAL_SEGMENTS = new Set([
    'agent', 'subagents', 'overflow', 'bypass-banner', 'worktree', 'vim',
    'session-name', 'output-style',
]);

export function buildSchema() {
    return [
        // ── page 1: preset ──
        { kind: 'header', label: 'preset', page: 1 },
        {
            page: 1,
            id: 'preset', kind: 'enum', label: 'preset',
            options: PRESET_NAMES,
            help: 'starting template. changing this replaces segments; tune below after.',
            onChange: (state, next) => applyPreset(state, next),
        },

        // ── page 2: layout (bars, thresholds, refresh) ──
        // User's spec: bar-width knobs are the FIRST two options on the layout
        // page, stacked vertically. They replace the old master `show.bars`
        // kill-switch (removed in 1.5.0) — users tune widths instead of hiding
        // the bars entirely.
        { kind: 'header', label: 'bars — width in bubbles', page: 2 },
        { page: 2, id: 'rateBarWidth',    kind: 'number', label: 'rate bars (5h/7d)', step: 1, min: 0, max: 30, help: 'bubble count for `current` and `weekly` rows' },
        { page: 2, id: 'contextBarWidth', kind: 'number', label: 'context bar',       step: 5, min: 20, max: 120, help: 'bubble count for the full-width context fuel-gauge' },

        { kind: 'header', label: 'thresholds — when bars turn yellow/red', page: 2 },
        { page: 2, id: 'thresholds.warn_at',     kind: 'number', label: 'warn at % (→ yellow)',    step: 5, min: 0, max: 100 },
        { page: 2, id: 'thresholds.critical_at', kind: 'number', label: 'critical at % (→ red)',   step: 5, min: 0, max: 100 },

        { kind: 'header', label: 'refresh', page: 2 },
        { page: 2, id: 'refreshInterval', kind: 'enum', label: 'refresh (sec)', options: ['0', '5', '10', '15', '30', '60', '300'], help: '0 = event-driven only. 5 is the sweet spot for live countdowns without burning CPU.' },

        // ── page 3: appearance ──
        { kind: 'header', label: 'appearance', page: 3 },
        { page: 3, id: 'colors',    kind: 'bool', label: 'colors',    help: '24-bit ansi colors — master on/off' },
        { page: 3, id: 'palette',   kind: 'enum', label: 'palette',   options: ENUMS.palette,  help: '6 hand-picked palettes — see gradient preview above' },
        { page: 3, id: 'icons',     kind: 'enum', label: 'icons',     options: ENUMS.icons,    help: 'auto falls back to ascii on ssh / legacy terms. nerd needs a nerd-font.' },
        { page: 3, id: 'barStyle',  kind: 'enum', label: 'bar style', options: ENUMS.barStyle, help: 'glyphs for filled / empty bubbles' },
        { page: 3, id: 'separator', kind: 'enum', label: 'separator', options: ['·', '|', '→', '•', '—'], help: 'glyph between segments' },
        { page: 3, id: 'spacing',   kind: 'enum', label: 'spacing',   options: ENUMS.spacing, help: 'normal → "a · b", loose → "a  ·  b"' },

        // ── page 4: core segments ──
        // ctx and pace-explainer are LOCKED on — ctx picks a label style below
        // instead of a kill-switch. Optional / silent segments live on page 5.
        { kind: 'header', label: 'header', page: 4 },
        { page: 4, id: 'show.ctxLabel', kind: 'enum', label: 'ctx label', options: ENUMS.ctxLabel, help: '`text` → context 32% · `icon` → ✎ 32% · `none` → 32%' },

        { kind: 'header', label: 'core segments — always relevant', page: 4 },
        ...CORE_SEGMENTS.map(name => ({
            page: 4,
            id: `segment.${name}`,
            kind: 'segment',
            label: name,
            help: SEGMENT_HELP[name] || '',
            locked: LOCKED_SEGMENTS.has(name),
        })),

        { kind: 'header', label: 'git + ssh', page: 4 },
        { page: 4, id: 'show.branch',   kind: 'bool', label: 'show branch',       help: 'append (branch) to dir' },
        { page: 4, id: 'show.dirty',    kind: 'bool', label: 'show dirty marker', help: 'red * when work tree has changes' },
        { page: 4, id: 'hostnameStyle', kind: 'enum', label: 'ssh hostname',      options: ENUMS.hostnameStyle, help: 'short strips .domain suffix — cycle to see the diff' },

        // ── page 5: optional features ──
        // Everything moved here is silent-until-its-data-is-present OR a
        // formatting knob that most users leave alone.
        { kind: 'header', label: 'optional formatting', page: 5 },
        { page: 5, id: 'modelFormat', kind: 'enum',   label: 'model name',      options: ENUMS.modelFormat, help: 'full = "Opus 4.7 (1M context)" · short drops "(…)" · code lowercases' },
        { page: 5, id: 'dirStyle',    kind: 'enum',   label: 'directory style', options: ENUMS.dirStyle,    help: 'tilde = ~/dev/x · basename = x · smart = tilde if short else basename' },
        { page: 5, id: 'dirMaxLen',   kind: 'number', label: 'dir max chars',   step: 1, min: 8, max: 80,   help: 'budget for smart/tilde collapse; 23 fits most ~/dev/<project> trees' },

        { kind: 'header', label: 'optional segments — off by default, silent when absent', page: 5 },
        ...OPTIONAL_SEGMENTS.map(name => ({
            page: 5,
            id: `segment.${name}`,
            kind: 'segment',
            label: name,
            help: SEGMENT_HELP[name] || '',
            locked: LOCKED_SEGMENTS.has(name),
        })),
    ];
}

export function initWizardState(input = {}, options = {}) {
    const { config, path } = loadConfig(input, options);
    const savedCfg = structuredClone(config);
    return {
        path,
        savedCfg,
        state: { ...DEFAULTS, ...structuredClone(savedCfg) },
    };
}

// Focus-only text help. Shown to the RIGHT of a field when it's focused and
// no palette-accurate example exists for that field (see SEGMENT_EXAMPLE /
// ENUM_EXAMPLE builders below). For segment toggles and high-signal enums,
// the example replaces this text — a rendered sample teaches more than prose.
const SEGMENT_HELP = {
    ssh: 'shows 🔒 <host> on remote, silent locally',
    model: 'Claude model display name',
    ctx: 'ctx % from current_usage',
    dir: 'cwd basename + (branch)',
    '5h': 'compact 5-hour rate-limit %',
    '7d': 'compact 7-day rate-limit %',
    'rate-5h-full': 'full 5h line: bar + % + reset + countdown',
    'rate-7d-full': 'full 7d line: bar + % + reset + countdown',
    'context-bar': 'wide fuel-gauge bar for context usage',
    'bypass-banner': '▶▶ bypass permissions — only when active',
    session: 'wall-clock elapsed (alias for elapsed)',
    elapsed: 'wall-clock elapsed via cost.total_duration_ms',
    effort: '$CLAUDE_CODE_EFFORT_LEVEL indicator',
    cost: '$ session cost via cost.total_cost_usd',
    lines: '+adds -dels from cost.total_lines_*',
    worktree: '🌿 worktree name on --worktree sessions',
    agent: '🤖 subagent name on --agent sessions',
    subagents: '🤖 active subagent count from the payload or transcript reducer',
    vim: '-- NORMAL -- / -- INSERT -- when vim mode on',
    'session-name': '[name] from --name / /rename',
    'output-style': 'non-default output_style.name',
    overflow: '⚠ >200k — when exceeds_200k_tokens is set',
};

// ── Inline examples ─────────────────────────────────────
// Palette-accurate rendered samples shown beside every segment toggle and
// high-signal enum. Always visible — they resolve the "toggle looks identical
// when preview drops the segment" problem by giving each row its own visual
// of what "on" means.
//
// Rebuilt only when palette / colors / icons / barStyle change; segment
// toggles flipping on/off don't invalidate this cache.
let _exampleKey = null;
let _exampleCache = null;
function getExamples(state) {
    const colorsOn = colorsEnabled(undefined, state.colors);
    const key = `${state.palette}|${colorsOn}|${state.icons}|${state.barStyle}`;
    if (key === _exampleKey && _exampleCache) return _exampleCache;
    const palette = makePalette(colorsOn, state.palette);
    const icons = applyBarStyle(pickIcons(state.icons), state.barStyle);
    const thresholds = state.thresholds || { warn_at: 35, critical_at: 70 };
    const bar = (pct, width = 5) => buildBar(pct, width, icons, palette, thresholds);
    const isAscii = icons.agent === 'agent';

    const segments = {
        ssh:              `${palette.magenta(icons.ssh)} ${palette.magenta('preview-host')}`,
        model:            palette.blue('Opus 4.7'),
        ctx:              `${palette.dim('context ')}${palette.green('32%')}`,
        dir:              palette.cyan('~/dev/lean-statusline'),
        'rate-5h-full':   `${palette.white('current')} ${bar(40, 5)} ${palette.green('40%')}`,
        'rate-7d-full':   `${palette.white('weekly')} ${bar(47, 5)} ${palette.yellow('47%')}`,
        'context-bar':    `${palette.white('context')} ${bar(32, 6)}`,
        'pace-explainer': `${palette.yellow(icons.warn)} ${palette.dim('5h cap in ')}${palette.yellow('18m')}`,
        effort:           palette.magenta(`${icons.effortHigh} high`),
        elapsed:          `${palette.dim(`${icons.timer} `)}${palette.white('45m')}`,
        agent:            `${palette.dim(icons.agent)} ${palette.magenta('reviewer')}`,
        subagents:        palette.magenta(isAscii ? 'agents:2' : `${icons.agent}×2`),
        overflow:         palette.red(`${icons.warn} >200k`),
        cost:             `${palette.dim(icons.money)} ${palette.yellow('$0.23')}`,
        lines:            `${palette.green('+156')} ${palette.red('-23')}`,
        worktree:         `${palette.dim(icons.worktree)} ${palette.cyan('feat-branch')}`,
        vim:              palette.blue('-- NORMAL --'),
        'session-name':   palette.dim('[mypr-3]'),
        'output-style':   palette.dim('explanatory'),
        'bypass-banner':  `${palette.red(icons.bypass)} ${palette.red('bypass on')}`,
    };

    // Enum examples — keyed by field id, value = per-option rendered sample.
    // Kept tight (<22 visible chars) so rows stay under 80 cols even on
    // high-signal fields that already have wide value columns.
    const enums = {
        hostnameStyle: {
            short: palette.magenta(`${icons.ssh} preview-host`),
            full:  palette.magenta(`${icons.ssh} preview-host.local.dev`),
        },
        modelFormat: {
            full:  palette.blue('Opus 4.7 (1M ctx)'),
            short: palette.blue('Opus 4.7'),
            code:  palette.blue('opus-4-7'),
        },
        dirStyle: {
            tilde:    palette.cyan('~/dev/lean-statusline'),
            basename: palette.cyan('lean-statusline'),
            smart:    palette.cyan('~/dev/lean-statusline'),
        },
        'show.ctxLabel': {
            text: `${palette.dim('context ')}${palette.green('32%')}`,
            icon: `${palette.dim(`${icons.ctx} `)}${palette.green('32%')}`,
            none: palette.green('32%'),
        },
    };

    _exampleKey = key;
    _exampleCache = { segments, enums };
    return _exampleCache;
}

// Wrap an already-ANSI-colored string so its content renders dim. Strips the
// inner color codes so the outer dim attribute reaches every character — you
// can't just prepend `ESC[2m` to a string that contains its own `ESC[0m`
// resets without the resets clearing the dim mid-string.
function dimExample(example) {
    if (!example) return '';
    return `${DIM}${stripAnsi(example)}${RESET}`;
}

// ── State access helpers (id → path) ────────────────────
function getValue(state, id) {
    if (id.startsWith('segment.')) return state.segments.includes(id.slice(8));
    if (id.startsWith('show.'))       return !!state.show[id.slice(5)];
    if (id.startsWith('thresholds.')) return state.thresholds[id.slice(11)];
    return state[id];
}

function setValue(state, id, value) {
    const next = structuredClone(state);
    if (id.startsWith('segment.')) {
        const name = id.slice(8);
        const present = next.segments.includes(name);
        if (value && !present) next.segments = insertAtCanonicalPosition(next.segments, name, next);
        else if (!value && present) next.segments = collapseNewlines(next.segments.filter(s => s !== name));
    } else if (id.startsWith('show.')) {
        next.show = { ...next.show, [id.slice(5)]: value };
    } else if (id.startsWith('thresholds.')) {
        next.thresholds = { ...next.thresholds, [id.slice(11)]: value };
    } else if (id === 'refreshInterval' && typeof value === 'string') {
        // refreshInterval is an enum in the wizard (string options) but stored
        // as a number on disk — `npm config` / CC both expect numeric refresh.
        next[id] = Number.parseInt(value, 10) || 0;
    } else {
        next[id] = value;
    }
    return next;
}

// Toggling a segment ON needs to put it back on the correct line. The active
// preset's segments list is the source of truth for line structure — it
// contains `\n` markers at the right positions, so we use it to figure out
// "which line this segment canonically lives on" and insert at that line.
//
// Previously we used KNOWN_SEGMENTS (which has no `\n`s), so re-toggling
// context-bar dropped it onto line 1 next to the header instead of its
// own row — visible as an inline `context ●●●…` mixed in with `ssh · model`.
function canonicalSegmentListFor(state) {
    const presetName = resolvePresetAlias(state?.preset ?? 'compact');
    return PRESETS[presetName]?.config?.segments ?? DEFAULTS.segments ?? KNOWN_SEGMENTS;
}

function insertAtCanonicalPosition(segments, name, state) {
    const canonical = canonicalSegmentListFor(state);
    const canonicalIdx = canonical.indexOf(name);
    if (canonicalIdx < 0) return [...segments, name];

    // Target line = number of `\n` markers before the segment in canonical.
    const targetLine = canonical.slice(0, canonicalIdx).filter(s => s === '\n').length;
    // Predecessors (non-`\n`) give us the natural neighbour to insert after.
    const predecessors = new Set(canonical.slice(0, canonicalIdx).filter(s => s !== '\n'));

    let insertAt = 0;
    for (let i = segments.length - 1; i >= 0; i--) {
        if (predecessors.has(segments[i])) { insertAt = i + 1; break; }
    }

    // If the current line count is short of the target, pad with `\n`s so
    // the segment ends up on its own row (matches the preset's layout).
    const currentLine = segments.slice(0, insertAt).filter(s => s === '\n').length;
    const padding = Array(Math.max(0, targetLine - currentLine)).fill('\n');
    return [...segments.slice(0, insertAt), ...padding, name, ...segments.slice(insertAt)];
}

// Removing a segment can leave an orphan `\n` (line became empty). Collapse
// consecutive `\n`s and trim leading/trailing ones so the render doesn't
// produce ghost blank rows between survivors.
function collapseNewlines(segs) {
    const out = [];
    for (const s of segs) {
        if (s === '\n' && (out.length === 0 || out[out.length - 1] === '\n')) continue;
        out.push(s);
    }
    while (out.length && out[out.length - 1] === '\n') out.pop();
    return out;
}

// ── Keystroke adjustment ────────────────────────────────
function adjust(state, field, direction, schemaValue) {
    // direction: -1 | +1 | 'toggle'
    if (field.kind === 'bool' || field.kind === 'segment') {
        return setValue(state, field.id, !schemaValue);
    }
    if (field.kind === 'enum') {
        const opts = field.options;
        // refreshInterval stores a number on disk but the enum options are
        // strings. Stringify the current value so indexOf finds a match.
        const curKey = field.id === 'refreshInterval' ? String(schemaValue ?? 0) : schemaValue;
        const cur = opts.indexOf(curKey);
        const next = direction === 'toggle'
            ? opts[(cur + 1) % opts.length]
            : opts[(cur + direction + opts.length) % opts.length];
        if (field.onChange) return field.onChange(state, next);
        return setValue(state, field.id, next);
    }
    if (field.kind === 'number') {
        const step = field.step || 1;
        const cur = Number(schemaValue ?? 0);
        const delta = direction === 'toggle' ? step : direction * step;
        let next = cur + delta;
        if (field.min != null) next = Math.max(field.min, next);
        if (field.max != null) next = Math.min(field.max, next);
        return setValue(state, field.id, next);
    }
    return state;
}

// ── Preview renderer ────────────────────────────────────
// Memoized per state reference. setValue() returns a fresh object on every
// change, so arrow/tab/save keys that don't mutate state get cache hits and
// skip the full renderLine pipeline on every redraw.
let _lastPreviewState = null;
let _lastPreviewOutput = '';

function renderPreview(state) {
    if (state === _lastPreviewState) return _lastPreviewOutput;
    const palette = makePalette(colorsEnabled(undefined, state.colors), state.palette);
    const icons = applyBarStyle(pickIcons(state.icons), state.barStyle);
    // 1.5.0: preview width tracks the real terminal. Reserve 4 cols for the
    // wizard's chrome padding + 2 cols for the `…` ellipsis room. Without
    // this SAMPLE_INPUT.terminal.columns, the context-bar segment renders
    // at a width that overflows narrow terminals and the user can't tell.
    const previewWidth = process.stdout.columns
        ? Math.max(60, process.stdout.columns - 4)
        : 100;
    // Preview-only cfg: never leaks to disk or real render path.
    //   - respect the ssh toggle: fake host only when user turned ssh on
    //   - clear dropOrder so no toggle silently drops from the preview
    //     (the per-line ellipsis fallback in layout.mjs still handles true
    //     overflow visibly with a trailing `…`). Rate-bar layout stays
    //     preset-driven: current + weekly render on the same line when the
    //     user's preset groups them there, matching the real statusline.
    const sshEnabled = (state.segments || []).includes('ssh');
    const previewCfg = {
        ...state,
        layout: { ...(state.layout || {}), dropOrder: [] },
    };
    const prevSshHost = process.env.LEAN_STATUSLINE_SSH_HOST;
    const prevSshKind = process.env.LEAN_STATUSLINE_SSH_KIND;
    // `preview-host.local.dev` has a real domain so cycling
    // `hostnameStyle: short ↔ full` produces a visible diff (`preview-host`
    // vs `preview-host.local.dev`). Only set when ssh is toggled on —
    // otherwise the segment isn't rendered and the env override is unneeded.
    if (sshEnabled) {
        process.env.LEAN_STATUSLINE_SSH_HOST = 'preview-host.local.dev';
        process.env.LEAN_STATUSLINE_SSH_KIND = 'remote';
    }
    const previewInput = {
        ...SAMPLE_INPUT,
        terminal: { columns: previewWidth },
    };
    const ctx = {
        input: previewInput,
        cfg: previewCfg,
        palette,
        icons,
        rateLimits: SAMPLE_CTX_RATES,
        dangerousPerms: true,
        effortLevel: 'high',
        contextPct: readContextPct(previewInput),
        ccUpdate: '2.2.0',
        layoutTagged: true,
    };
    try {
        const rendered = renderLine(ctx);
        _lastPreviewOutput = applyLayout(ctx, rendered, previewWidth);
    } finally {
        if (prevSshHost === undefined) delete process.env.LEAN_STATUSLINE_SSH_HOST;
        else process.env.LEAN_STATUSLINE_SSH_HOST = prevSshHost;
        if (prevSshKind === undefined) delete process.env.LEAN_STATUSLINE_SSH_KIND;
        else process.env.LEAN_STATUSLINE_SSH_KIND = prevSshKind;
    }
    _lastPreviewState = state;
    return _lastPreviewOutput;
}

// Footer note listing which enabled segments are silent-when-absent in real
// CC — so users don't look for the preview mock and wonder why it's "missing"
// after install. Returns null when no conditional segments are active.
function conditionalPreviewNote(state) {
    const active = (state.segments || [])
        .filter(n => CONDITIONAL_SEGMENTS.has(n));
    if (active.length === 0) return null;
    return `note: ${active.join(' / ')} only shows when its data is actually present`;
}

// Palette gradient demo — a row of five bars at 10/30/50/70/90% so every
// threshold color (green/yellow/red) is visible simultaneously.
// Used on page 2 so palette/barStyle switches give immediate, readable
// feedback beyond the stock preview.
function renderPaletteDemo(state) {
    const palette = makePalette(colorsEnabled(undefined, state.colors), state.palette);
    const icons = applyBarStyle(pickIcons(state.icons), state.barStyle);
    const width = 10;
    const samples = [10, 30, 55, 75, 95];
    const cells = samples.map(p => {
        const bar = buildBar(p, width, icons, palette, state.thresholds);
        const color = colorForPct(p, state.thresholds, palette);
        return `${bar} ${color(`${p}%`.padStart(3))}`;
    });
    return `${palette.dim('palette')} ${cells.join(palette.dim('  '))}`;
}

// ── Focusable index helpers ─────────────────────────────
// Focusable = non-header AND non-locked. Locked segments (ctx, 5h, 7d)
// render for context but can't receive focus — user shouldn't waste time
// arrowing onto something they can't change.
function focusableIndices(schema) {
    const out = [];
    schema.forEach((f, i) => { if (f.kind !== 'header' && !f.locked) out.push(i); });
    return out;
}

function focusableIndicesOnPage(schema, page) {
    const out = [];
    schema.forEach((f, i) => {
        if (f.kind !== 'header' && !f.locked && f.page === page) out.push(i);
    });
    return out;
}

function firstFocusableOnPage(schema, page) {
    return focusableIndicesOnPage(schema, page)[0];
}

function moveFocus(schema, current, direction, page) {
    const focusable = focusableIndicesOnPage(schema, page);
    const pos = focusable.indexOf(current);
    if (pos < 0) return focusable[0] ?? current;
    const next = pos + direction;
    if (next < 0 || next >= focusable.length) return current;  // clamp at page edges
    return focusable[next];
}

// Cycle pages; tab goes forward, shift-tab back. Wraps at boundaries.
function nextPage(page)  { return page >= TOTAL_PAGES ? 1 : page + 1; }
function prevPage(page)  { return page <= 1 ? TOTAL_PAGES : page - 1; }

// ── Rendering ───────────────────────────────────────────
function formatValue(field, value) {
    if (field.kind === 'bool' || field.kind === 'segment') {
        if (field.locked) {
            return `${C_CYAN}[●]${RESET} ${DIM}always on${RESET}`;
        }
        return value ? `${C_GREEN}[✓]${RESET} on` : `${DIM}[ ]${RESET} off`;
    }
    if (field.kind === 'enum') {
        const val = value ?? field.options[0];
        return `${DIM}‹${RESET} ${BOLD}${val}${RESET} ${DIM}›${RESET}`;
    }
    if (field.kind === 'number') {
        const val = value ?? 0;
        return `${DIM}‹${RESET} ${BOLD}${String(val).padStart(3)}${RESET} ${DIM}›${RESET}`;
    }
    return String(value);
}

function renderForm(schema, focus, state, width, page) {
    const out = [];
    const labelCol = 24;  // fixed col for value to align
    const valuePadTo = 14;  // visible width the value column gets padded to
    const examples = getExamples(state);

    // Pick the right example for a field. Segments always get a fixed sample;
    // enums get per-option samples keyed by the current value. Returns '' for
    // fields with no example (numerics, master on/off bools, palette/icon
    // enums handled by the page-3 palette demo).
    function exampleFor(field, value) {
        if (field.kind === 'segment') return examples.segments[field.label] ?? '';
        if (field.kind === 'enum') {
            const perOption = examples.enums[field.id];
            if (!perOption) return '';
            const key = value ?? field.options[0];
            return perOption[key] ?? '';
        }
        return '';
    }

    for (let i = 0; i < schema.length; i++) {
        const f = schema[i];
        // Stepped pagination: skip entries outside the current page.
        if (page != null && f.page !== page) continue;

        // Locked (non-focusable) fields render with a dim cursor slot so
        // they stay visually aligned with focusable neighbors but never
        // receive the focus arrow. Locked = always-on, so example is full
        // color (never dimmed).
        if (f.locked) {
            const value = getValue(state, f.id);
            const labelStr = f.label.padEnd(20);
            const val = formatValue(f, value);
            const ex = exampleFor(f, value);
            const pad = ' '.repeat(Math.max(0, valuePadTo - stripAnsi(val).length));
            const exCol = ex ? `  ${ex}` : '';
            out.push(`  ${DIM}${labelStr}${RESET}${val}${pad}${exCol}`);
            continue;
        }

        if (f.kind === 'header') {
            out.push('');
            out.push(`${DIM}── ${f.label} ──${RESET}`);
            continue;
        }

        const isFocused = i === focus;
        const value = getValue(state, f.id);
        const labelStr = f.label.padEnd(labelCol - 4);
        const arrow = isFocused ? `${C_CYAN}❯${RESET} ` : '  ';
        const label = isFocused ? `${BOLD}${labelStr}${RESET}` : `${DIM}${labelStr}${RESET}`;
        const val = formatValue(f, value);
        const pad = ' '.repeat(Math.max(0, valuePadTo - stripAnsi(val).length));

        // Always-visible example column. Segment examples dim when the
        // segment is off so the row still reads "off" at a glance; enum
        // examples render full-color (enum value and example both reflect
        // the current selection). Fall through to focused-only help text
        // for fields without examples (numeric, master bools, palette).
        const rawExample = exampleFor(f, value);
        let exCol = '';
        if (rawExample) {
            if (f.kind === 'segment' && !value) exCol = `  ${dimExample(rawExample)}`;
            else exCol = `  ${rawExample}`;
        }

        let line = `${arrow}${label}${val}${pad}${exCol}`;
        if (!rawExample && isFocused && f.help) {
            line += `    ${DIM}${f.help}${RESET}`;
        }
        out.push(line);
    }
    return out;
}

// ── Main entry ──────────────────────────────────────────
export async function runWizard() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error('wizard needs a tty. use flags or --preset instead.');
        process.exit(1);
    }

    const rows = process.stdout.rows || 40;
    const cols = process.stdout.columns || 80;
    if (rows < 20) {
        console.error(`wizard needs at least 20 rows (terminal reports ${rows}). resize or use flags.`);
        process.exit(1);
    }

    // Seed state from the active resolved config path.
    const { savedCfg, path: configPath, state: initialState } = initWizardState();
    let state = initialState;

    const schema = buildSchema();
    // currentPage is derived from focus — the schema tags each field with
    // its page, so `schema[focus].page` is the source of truth. No separate
    // state to keep in sync.
    let focus = firstFocusableOnPage(schema, 1);
    let status = '';  // status bar message (e.g. "saved", "reset")

    const cleanup = enterRawMode();
    process.on('exit', cleanup);

    try {
        while (true) {
            const currentPage = schema[focus].page;

            let out = CLEAR;
            const title = PAGE_TITLES[currentPage] || '';
            const leftHeader = `${BOLD}lean-statusline${RESET} ${DIM}· configure · step ${currentPage} / ${TOTAL_PAGES}${RESET}  ${C_CYAN}${title}${RESET}`;
            const rightHeader = `${DIM}q·quit  r·reset  s·save${RESET}`;
            const headerPad = Math.max(1, cols - stripAnsi(leftHeader).length - stripAnsi(rightHeader).length);
            out += leftHeader + ' '.repeat(headerPad) + rightHeader + '\n';
            out += HR(cols) + '\n';

            // Page 5 has enough form rows (12 toggles + 3 formatting + 2
            // headers) that the full preview block pushes the footer under
            // the fold on 24-row terminals. Compress to just the main
            // statusline line — segment toggles on page 5 don't affect the
            // rate-bar or context-bar rows, and the always-visible inline
            // examples (rendered inside renderForm) give each toggle its
            // own visual regardless of what the preview shows.
            const fullPreview = renderPreview(state);
            const previewBody = currentPage === 5
                ? fullPreview.split('\n')[0]
                : fullPreview;
            out += `${DIM}preview${RESET}\n${previewBody}\n`;
            // On the appearance page (now step 3), append a gradient demo row —
            // walks the bar from low → high fill so every threshold color
            // (green/orange/yellow/red) is visible for the active palette/barStyle.
            if (currentPage === 3) {
                out += renderPaletteDemo(state) + '\n';
            }
            // Footer note listing conditional segments active in the current
            // config so users understand why a mock-only segment (agent,
            // subagents, overflow, …) appears in preview but may not show up
            // in real CC until its data is present. Suppressed on page 5 —
            // the inline examples next to each toggle already communicate
            // which segments are silent-when-absent.
            if (currentPage !== 5) {
                const condNote = conditionalPreviewNote(state);
                if (condNote) out += `${DIM}${condNote}${RESET}\n`;
            }
            // 1.5.0: double-rule between preview and the form block so the
            // section-header stops blending into the preview block visually.
            out += `${DIM}${'═'.repeat(cols)}${RESET}\n`;

            out += renderForm(schema, focus, state, cols, currentPage).join('\n') + '\n';

            out += HR(cols) + '\n';
            out += `${DIM}↑↓ field · ←→ change · space toggle · enter / tab next step · s save · q quit${RESET}`;
            if (status) out += `   ${C_GREEN}${status}${RESET}`;
            process.stdout.write(out);

            const key = await readKey();
            status = '';

            if (key === 'ctrl-c') process.exit(130);
            if (key === 'q' || key === 'esc') {
                cleanup();
                process.stdout.write(CLEAR + DIM + 'quit without saving.\n' + RESET);
                return;
            }
            if (key === 's') {
                const errs = validateConfig(state);
                if (errs.length) {
                    status = `${C_RED}invalid: ${errs.join('; ')}${RESET}`;
                    continue;
                }
                saveConfig(state, configPath);
                cleanup();
                process.stdout.write(CLEAR);
                process.stdout.write(`${C_GREEN}✓ saved${RESET} ${DIM}${configPath}${RESET}\n\n`);
                process.stdout.write(`preview:\n${renderPreview(state)}\n\n`);
                process.stdout.write(`${DIM}run \`lean-statusline doctor\` to verify wiring.${RESET}\n`);
                return;
            }
            if (key === 'r') {
                state = { ...DEFAULTS, ...structuredClone(savedCfg) };
                status = 'reset to saved config.';
                continue;
            }
            if (key === 'up')   { focus = moveFocus(schema, focus, -1, currentPage); continue; }
            if (key === 'down') { focus = moveFocus(schema, focus, +1, currentPage); continue; }
            // Enter / Tab / PageDown = "commit + advance to next step" — matches
            // form-wizard conventions. Wraps at last page back to first.
            if (key === 'enter' || key === 'tab' || key === 'pagedown') {
                focus = firstFocusableOnPage(schema, nextPage(currentPage));
                continue;
            }
            if (key === 'shift-tab' || key === 'pageup') {
                focus = firstFocusableOnPage(schema, prevPage(currentPage));
                continue;
            }
            if (key === 'home') { focus = focusableIndicesOnPage(schema, currentPage)[0]; continue; }
            if (key === 'end')  { focus = focusableIndicesOnPage(schema, currentPage).slice(-1)[0]; continue; }

            const f = schema[focus];
            if (!f) continue;
            const cur = getValue(state, f.id);
            if (key === 'left')  { state = adjust(state, f, -1, cur); continue; }
            if (key === 'right') { state = adjust(state, f, +1, cur); continue; }
            if (key === 'space') { state = adjust(state, f, 'toggle', cur); continue; }
        }
    } finally {
        cleanup();
    }
}

