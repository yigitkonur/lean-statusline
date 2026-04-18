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
import { PRESETS, PRESET_NAMES, applyPreset } from './presets.mjs';
import { DEFAULTS, ENUMS, loadConfig, saveConfig, validateConfig, CONFIG_PATH, KNOWN_SEGMENTS } from './config.mjs';
import { renderLine, detectDangerousPerms, resolveEffortLevel, readContextPct } from './segments.mjs';
import {
    CLEAR, HIDE_CUR, SHOW_CUR, BOLD, DIM, RESET,
    C_GREEN, C_CYAN, C_RED,
    HR, stripAnsi, enterRawMode, readKey,
} from './tui.mjs';

// ── Sample payload for the preview ──────────────────────
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
    output_style: { name: 'default' },
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
const TOTAL_PAGES = 6;
const PAGE_TITLES = {
    1: 'preset',
    2: 'appearance + palette',
    3: 'formats + git',
    4: 'core segments',
    5: 'rich segments',
    6: 'thresholds + advanced',
};

// Explicit named lists instead of slicing KNOWN_SEGMENTS by position —
// reordering config.mjs's KNOWN_SEGMENTS no longer silently reshuffles
// wizard pages. `session` is the alias of `elapsed` and intentionally
// omitted so the wizard doesn't let users check both (which would
// produce duplicate output before the render-time dedup guard).
const CORE_SEGMENTS = Object.freeze([
    'ssh', 'model', 'ctx', 'dir', '5h', '7d',
    'rate-5h-full', 'rate-7d-full', 'context-bar', 'bypass-banner',
]);
const RICH_SEGMENTS = Object.freeze([
    'elapsed', 'effort', 'cost', 'lines',
    'worktree', 'agent', 'vim',
    'session-name', 'output-style', 'overflow',
]);

// Segments the wizard refuses to toggle. Context usage + the rate-limit
// windows (compact `5h`/`7d` and the bar-style `rate-5h-full`/`rate-7d-full`)
// are the numbers you actually need to glance at — locking them prevents a
// casual preset pick from silently removing the signal. If a user really
// wants to drop them they can hand-edit lean-statusline.json.
const LOCKED_SEGMENTS = new Set([
    'ctx',
    '5h', '7d',
    'rate-5h-full', 'rate-7d-full',
]);

function buildSchema() {
    const coreSegments = CORE_SEGMENTS;
    const richSegments = RICH_SEGMENTS;

    return [
        // ── page 1: preset ──
        { kind: 'header', label: 'preset', page: 1 },
        {
            page: 1,
            id: 'preset', kind: 'enum', label: 'preset',
            options: PRESET_NAMES,
            help: 'starting template. changing this replaces segments; tune below after.',
            // applyPreset only rewrites segments/show/separator/contextBarWidth
            // from the preset's config; user's colors/icons/refreshInterval
            // survive automatically via the spread in applyPreset itself.
            onChange: (state, next) => applyPreset(state, next),
        },

        // ── page 2: appearance + palette ──
        { kind: 'header', label: 'appearance', page: 2 },
        { page: 2, id: 'colors',    kind: 'bool', label: 'colors',    help: '24-bit ansi colors — master on/off' },
        { page: 2, id: 'palette',   kind: 'enum', label: 'palette',   options: ENUMS.palette,  help: 'color scheme — see gradient preview above' },
        { page: 2, id: 'icons',     kind: 'enum', label: 'icons',     options: ENUMS.icons,    help: 'auto falls back to ascii on ssh/unknown terminals' },
        { page: 2, id: 'barStyle',  kind: 'enum', label: 'bar style', options: ENUMS.barStyle, help: 'glyphs for filled / empty bubbles' },
        { page: 2, id: 'separator', kind: 'enum', label: 'separator', options: ['·', '|', '→', '•', ':', '/', '—'], help: 'glyph between segments' },
        { page: 2, id: 'spacing',   kind: 'enum', label: 'spacing',   options: ENUMS.spacing, help: 'padding around separators' },

        // ── page 3: formats + git ──
        { kind: 'header', label: 'bar toggle — applies to every bar-producing segment', page: 3 },
        { page: 3, id: 'show.bars',   kind: 'bool', label: 'show bars everywhere', help: 'single switch for ctx, 5h, 7d, rate-*-full, and context-bar' },
        { page: 3, id: 'ctxBarWidth', kind: 'number', label: 'ctx bar bubbles', step: 2, min: 0, max: 40, help: 'width of the inline ctx bar (20 = 2x the rate scale)' },
        { page: 3, id: 'rateBarWidth', kind: 'number', label: '5h/7d bar bubbles', step: 1, min: 0, max: 30, help: 'width of the compact rate bars' },

        { kind: 'header', label: 'formats', page: 3 },
        { page: 3, id: 'modelFormat',   kind: 'enum',   label: 'model name',      options: ENUMS.modelFormat, help: 'full / short drops "(…)" / code lowercases+hyphenates' },
        { page: 3, id: 'dirStyle',      kind: 'enum',   label: 'directory style', options: ENUMS.dirStyle,    help: 'smart collapses to basename when > dir max chars' },
        { page: 3, id: 'dirMaxLen',     kind: 'number', label: 'dir max chars',   step: 5, min: 8, max: 80,   help: 'threshold for smart collapse. 30 fits ~/dev/<project>' },
        { page: 3, id: 'costPrecision', kind: 'number', label: 'cost decimals',   step: 1, min: 0, max: 4,    help: 'decimal places in the $ segment' },
        { page: 3, id: 'compactNumbers', kind: 'bool',  label: 'compact +/-',     help: 'lines render as +1.2k instead of +1234' },
        { page: 3, id: 'hostnameStyle', kind: 'enum',   label: 'ssh hostname',    options: ENUMS.hostnameStyle, help: 'short drops .local/domain suffix' },

        { kind: 'header', label: 'git / dir', page: 3 },
        { page: 3, id: 'show.branch',   kind: 'bool',   label: 'show branch',         help: 'append (branch) to dir' },
        { page: 3, id: 'show.dirty',    kind: 'bool',   label: 'show dirty marker',   help: 'red * when work tree has changes' },
        { page: 3, id: 'show.zap',      kind: 'bool',   label: 'show ⚡ on dangerous-perms', help: 'prefix when --dangerously-skip-permissions is active' },
        { page: 3, id: 'branchStyle',   kind: 'enum',   label: 'branch wrapper',      options: ENUMS.branchStyle, help: '(main) / [main] / {main} / main' },
        { page: 3, id: 'branchMaxLen',  kind: 'number', label: 'branch max chars',    step: 4, min: 0, max: 60, help: '0 = no limit; truncates long feat/ABC-… branches' },

        // ── page 4: core segments ──
        { kind: 'header', label: 'core segments — always relevant', page: 4 },
        ...coreSegments.map(name => ({
            page: 4,
            id: `segment.${name}`,
            kind: 'segment',
            label: name,
            help: SEGMENT_HELP[name] || '',
            locked: LOCKED_SEGMENTS.has(name),
        })),

        // ── page 5: rich segments ──
        { kind: 'header', label: 'rich segments — silent until their data is present', page: 5 },
        ...richSegments.map(name => ({
            page: 5,
            id: `segment.${name}`,
            kind: 'segment',
            label: name,
            help: SEGMENT_HELP[name] || '',
            locked: LOCKED_SEGMENTS.has(name),
        })),

        // ── page 6: thresholds + advanced ──
        { kind: 'header', label: 'thresholds (percentage colors)', page: 6 },
        { page: 6, id: 'thresholds.warn', kind: 'number', label: 'warn % (→ orange)', step: 5, min: 0, max: 100 },
        { page: 6, id: 'thresholds.high', kind: 'number', label: 'high % (→ yellow)', step: 5, min: 0, max: 100 },
        { page: 6, id: 'thresholds.crit', kind: 'number', label: 'crit % (→ red)',    step: 5, min: 0, max: 100 },

        { kind: 'header', label: 'advanced', page: 6 },
        { page: 6, id: 'contextBarWidth', kind: 'number', label: 'context bar width', step: 5, min: 20, max: 120, help: 'chars; wider = more granular fuel gauge' },
        { page: 6, id: 'refreshInterval', kind: 'number', label: 'refresh (sec)', step: 1, min: 0, max: 60, help: '0 = event-driven only. set 5 when using countdowns/cost/elapsed to avoid stale numbers' },
    ];
}

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
    vim: '-- NORMAL -- / -- INSERT -- when vim mode on',
    'session-name': '[name] from --name / /rename',
    'output-style': 'non-default output_style.name',
    overflow: '⚠ >200k — when exceeds_200k_tokens is set',
};

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
        if (value && !present) next.segments = insertAtCanonicalPosition(next.segments, name);
        else if (!value && present) next.segments = next.segments.filter(s => s !== name);
    } else if (id.startsWith('show.')) {
        next.show = { ...next.show, [id.slice(5)]: value };
    } else if (id.startsWith('thresholds.')) {
        next.thresholds = { ...next.thresholds, [id.slice(11)]: value };
    } else {
        next[id] = value;
    }
    return next;
}

// Insert a segment name at its canonical index so toggling back on
// restores it to "where it used to be" rather than appending at end.
const CANONICAL_ORDER = KNOWN_SEGMENTS.filter(s => s !== '\n');
function insertAtCanonicalPosition(segments, name) {
    const canonicalIdx = CANONICAL_ORDER.indexOf(name);
    if (canonicalIdx < 0) return [...segments, name];
    // Insert before the first segment whose canonical index is higher.
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (s === '\n') continue;
        if (CANONICAL_ORDER.indexOf(s) > canonicalIdx) {
            return [...segments.slice(0, i), name, ...segments.slice(i)];
        }
    }
    // Fallback: insert before the first \n, or at end.
    const nlIdx = segments.indexOf('\n');
    return nlIdx < 0 ? [...segments, name] : [...segments.slice(0, nlIdx), name, ...segments.slice(nlIdx)];
}

// ── Keystroke adjustment ────────────────────────────────
function adjust(state, field, direction, schemaValue) {
    // direction: -1 | +1 | 'toggle'
    if (field.kind === 'bool' || field.kind === 'segment') {
        return setValue(state, field.id, !schemaValue);
    }
    if (field.kind === 'enum') {
        const opts = field.options;
        const cur = opts.indexOf(schemaValue);
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
    const ctx = {
        input: SAMPLE_INPUT,
        cfg: state,
        palette,
        icons,
        rateLimits: SAMPLE_CTX_RATES,
        dangerousPerms: detectDangerousPerms(),
        effortLevel: resolveEffortLevel(),
        contextPct: readContextPct(SAMPLE_INPUT),
    };
    _lastPreviewOutput = renderLine(ctx);
    _lastPreviewState = state;
    return _lastPreviewOutput;
}

// Palette gradient demo — a row of five bars at 10/30/50/70/90% so every
// threshold color (green/orange/yellow/red) is visible simultaneously.
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

    for (let i = 0; i < schema.length; i++) {
        const f = schema[i];
        // Stepped pagination: skip entries outside the current page.
        if (page != null && f.page !== page) continue;

        // Locked (non-focusable) fields render with a dim cursor slot so
        // they stay visually aligned with focusable neighbors but never
        // receive the focus arrow.
        if (f.locked) {
            const value = getValue(state, f.id);
            const labelStr = f.label.padEnd(20);
            const val = formatValue(f, value);
            out.push(`  ${DIM}${labelStr}${RESET}${val}`);
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

        let line = `${arrow}${label}${val}`;

        // Append inline help for focused field only.
        if (isFocused && f.help) {
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

    // Seed state from the user's current config.
    const savedCfg = loadConfig().config;
    let state = { ...DEFAULTS, ...structuredClone(savedCfg) };

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

            out += `${DIM}preview${RESET}\n${renderPreview(state)}\n`;
            // On the appearance page, append a gradient demo row — walks the
            // bar from low → high fill so every threshold color (green/orange/
            // yellow/red) is visible for whichever palette+barStyle is active.
            if (currentPage === 2) {
                out += renderPaletteDemo(state) + '\n';
            }
            out += HR(cols) + '\n';

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
                saveConfig(state);
                cleanup();
                process.stdout.write(CLEAR);
                process.stdout.write(`${C_GREEN}✓ saved${RESET} ${DIM}${CONFIG_PATH}${RESET}\n\n`);
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

