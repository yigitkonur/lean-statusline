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

import { makePalette, pickIcons, colorsEnabled } from './colors.mjs';
import { PRESETS, PRESET_NAMES, applyPreset } from './presets.mjs';
import { DEFAULTS, loadConfig, saveConfig, validateConfig, CONFIG_PATH, KNOWN_SEGMENTS } from './config.mjs';
import { renderLine } from './segments.mjs';

// ── ANSI primitives ─────────────────────────────────────
const CLEAR      = '\x1b[2J\x1b[3J\x1b[H';
const HIDE_CUR   = '\x1b[?25l';
const SHOW_CUR   = '\x1b[?25h';
const BOLD       = '\x1b[1m';
const DIM        = '\x1b[2m';
const REV        = '\x1b[7m';
const RESET      = '\x1b[0m';
const C_GREEN    = '\x1b[32m';
const C_CYAN     = '\x1b[36m';
const C_YELLOW   = '\x1b[33m';
const C_RED      = '\x1b[31m';
const C_MAG      = '\x1b[35m';

const MOVE = (row, col) => `\x1b[${row};${col}H`;
const HR   = (w) => DIM + '─'.repeat(w) + RESET;

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
function buildSchema() {
    return [
        { kind: 'header', label: 'preset' },
        {
            id: 'preset', kind: 'enum', label: 'preset',
            options: PRESET_NAMES,
            help: 'starting template. changing this replaces segments; tune below after.',
            onChange: (state, next) => {
                // Apply full preset but preserve the user's taste knobs.
                const keep = {
                    colors: state.colors, icons: state.icons,
                    refreshInterval: state.refreshInterval,
                };
                return { ...applyPreset(state, next), ...keep };
            },
        },

        { kind: 'header', label: 'appearance' },
        { id: 'colors',    kind: 'bool', label: 'colors',    help: '24-bit ansi colors' },
        { id: 'icons',     kind: 'enum', label: 'icons',     options: ['auto', 'unicode', 'ascii'], help: 'auto falls back to ascii on ssh/unknown terminals' },
        { id: 'separator', kind: 'enum', label: 'separator', options: ['·', '|', '→', '•', ':', '/', '—'], help: 'glyph between segments' },

        { kind: 'header', label: 'git / dir' },
        { id: 'show.branch', kind: 'bool', label: 'show branch',      help: 'append (branch) to dir' },
        { id: 'show.dirty',  kind: 'bool', label: 'show dirty marker', help: 'red * when work tree has changes' },
        { id: 'show.zap',    kind: 'bool', label: 'show ⚡ on dangerous-perms', help: 'prefix when --dangerously-skip-permissions is active' },
        { id: 'show.bars',   kind: 'bool', label: 'show inline bars',  help: 'adds ●●●○○ next to percentages' },

        { kind: 'header', label: 'segments — each silent when its data is absent' },
        ...KNOWN_SEGMENTS.filter(s => s !== '\n').map(name => ({
            id: `segment.${name}`,
            kind: 'segment',
            label: name,
            help: SEGMENT_HELP[name] || '',
        })),

        { kind: 'header', label: 'thresholds (percentage colors)' },
        { id: 'thresholds.warn', kind: 'number', label: 'warn % (→ orange)', step: 5, min: 0, max: 100 },
        { id: 'thresholds.high', kind: 'number', label: 'high % (→ yellow)', step: 5, min: 0, max: 100 },
        { id: 'thresholds.crit', kind: 'number', label: 'crit % (→ red)',    step: 5, min: 0, max: 100 },

        { kind: 'header', label: 'advanced' },
        { id: 'contextBarWidth', kind: 'number', label: 'context bar width', step: 5, min: 20, max: 120, help: 'chars; wider = more granular fuel gauge' },
        { id: 'refreshInterval', kind: 'number', label: 'refresh (sec)', step: 1, min: 0, max: 60, help: '0 = event-driven only. set 5 when using countdowns/cost/elapsed to avoid stale numbers' },
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
function renderPreview(state) {
    const palette = makePalette(colorsEnabled(undefined, state.colors));
    const icons = pickIcons(state.icons);
    const ctx = { input: SAMPLE_INPUT, cfg: state, palette, icons, rateLimits: SAMPLE_CTX_RATES };
    return renderLine(ctx);
}

// ── Key parser ──────────────────────────────────────────
function parseKey(chunk) {
    switch (chunk) {
        case '\x03':  return 'ctrl-c';
        case '\r':
        case '\n':    return 'enter';
        case '\t':    return 'tab';
        case ' ':     return 'space';
        case '\x1b':  return 'esc';
        case '\x1b[A': return 'up';
        case '\x1b[B': return 'down';
        case '\x1b[C': return 'right';
        case '\x1b[D': return 'left';
        case '\x1b[5~': return 'pageup';
        case '\x1b[6~': return 'pagedown';
        case '\x1b[H':
        case '\x1b[1~': return 'home';
        case '\x1b[F':
        case '\x1b[4~': return 'end';
        default: return chunk;
    }
}

function readKey() {
    return new Promise(resolve => {
        const stdin = process.stdin;
        const onData = (chunk) => {
            stdin.removeListener('data', onData);
            resolve(parseKey(chunk));
        };
        stdin.on('data', onData);
    });
}

// ── Focusable index helpers ─────────────────────────────
function focusableIndices(schema) {
    const out = [];
    schema.forEach((f, i) => { if (f.kind !== 'header') out.push(i); });
    return out;
}

function moveFocus(schema, current, direction) {
    const focusable = focusableIndices(schema);
    const pos = focusable.indexOf(current);
    if (pos < 0) return focusable[0] ?? current;
    const next = pos + direction;
    if (next < 0 || next >= focusable.length) return current;  // clamp at edges
    return focusable[next];
}

function nextSectionIndex(schema, current) {
    for (let i = current + 1; i < schema.length; i++) {
        if (schema[i].kind === 'header') {
            // Return the first focusable AFTER this header.
            for (let j = i + 1; j < schema.length; j++) {
                if (schema[j].kind !== 'header') return j;
            }
        }
    }
    return current;
}

// ── Rendering ───────────────────────────────────────────
function formatValue(field, value) {
    if (field.kind === 'bool' || field.kind === 'segment') {
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

function renderForm(schema, focus, state, width) {
    const out = [];
    const labelCol = 24;  // fixed col for value to align

    for (let i = 0; i < schema.length; i++) {
        const f = schema[i];

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
    let focus = focusableIndices(schema)[0];
    let status = '';  // status bar message (e.g. "saved", "reset")

    // Enter raw mode.
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdout.write(HIDE_CUR);

    const cleanup = () => {
        try {
            process.stdin.setRawMode?.(false);
            process.stdout.write(SHOW_CUR + '\n');
        } catch { /* ignore */ }
    };
    process.on('exit', cleanup);

    try {
        while (true) {
            // ── Full redraw every frame ──
            let out = CLEAR;

            // Header
            out += `${BOLD}lean-statusline${RESET} ${DIM}· configure${RESET}`;
            const hint = `${DIM}q·quit  r·reset  s·save${RESET}`;
            const headerPad = Math.max(1, cols - stripAnsi(`lean-statusline · configure`).length - stripAnsi('q·quit  r·reset  s·save').length - 2);
            out += ' '.repeat(headerPad) + hint + '\n';
            out += HR(cols) + '\n';

            // Preview
            out += `${DIM}preview${RESET}\n`;
            out += renderPreview(state) + '\n';
            out += HR(cols) + '\n';

            // Form
            const lines = renderForm(schema, focus, state, cols);
            out += lines.join('\n') + '\n';

            // Status bar (bottom)
            out += HR(cols) + '\n';
            out += `${DIM}↑↓ move · ←→ change · space toggle · tab next section · s save · r reset · q quit${RESET}`;
            if (status) out += `   ${C_GREEN}${status}${RESET}`;

            process.stdout.write(out);

            // ── Wait for input ──
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
            if (key === 'up')   { focus = moveFocus(schema, focus, -1); continue; }
            if (key === 'down') { focus = moveFocus(schema, focus, +1); continue; }
            if (key === 'tab')  { focus = nextSectionIndex(schema, focus); continue; }
            if (key === 'home') { focus = focusableIndices(schema)[0]; continue; }
            if (key === 'end')  { focus = focusableIndices(schema).slice(-1)[0]; continue; }

            const f = schema[focus];
            if (!f) continue;
            const cur = getValue(state, f.id);
            if (key === 'left')  { state = adjust(state, f, -1, cur); continue; }
            if (key === 'right' || key === 'enter') { state = adjust(state, f, +1, cur); continue; }
            if (key === 'space') { state = adjust(state, f, 'toggle', cur); continue; }
            // any other key: ignore, redraw
        }
    } finally {
        cleanup();
    }
}

// Strip ANSI for width calculations.
function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*m/g, ''); }
