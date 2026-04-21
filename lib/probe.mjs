import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const UNSET = Symbol('lean-statusline.unset');

const EFFORT_LEVELS = new Set(['auto', 'low', 'medium', 'high']);

const source = Object.freeze({
    stdin: (path) => ({ kind: 'stdin', path }),
    env: (key) => ({ kind: 'env', key }),
    settingsEnv: (key) => ({ kind: 'settings-env', key }),
});

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
let cachedSettingsEnv;

function readSettingsEnv() {
    if (cachedSettingsEnv !== undefined) return cachedSettingsEnv;
    if (!existsSync(SETTINGS_PATH)) {
        cachedSettingsEnv = {};
        return cachedSettingsEnv;
    }
    try {
        cachedSettingsEnv = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'))?.env ?? {};
    } catch {
        cachedSettingsEnv = {};
    }
    return cachedSettingsEnv;
}

function getPath(obj, path) {
    if (!obj || typeof obj !== 'object') return UNSET;
    const parts = String(path).split('.');
    let cur = obj;
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object' || !(part in cur)) return UNSET;
        cur = cur[part];
    }
    return cur;
}

function asString(value) {
    if (typeof value === 'string') return value;
    return UNSET;
}

function asInt(value) {
    const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return UNSET;
    return Math.trunc(n);
}

function asNumber(value) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return UNSET;
    return n;
}

function asBool(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return UNSET;
}

function asPct(value) {
    const n = asNumber(value);
    if (n === UNSET) return UNSET;
    return Math.min(100, Math.max(0, Math.round(n)));
}

function asEnum(allowed) {
    return (value) => {
        if (typeof value !== 'string') return UNSET;
        return allowed.has(value) ? value : UNSET;
    };
}

function asArray() {
    return (value) => Array.isArray(value) ? value : UNSET;
}

function asObjectArray() {
    return (value) => Array.isArray(value) && value.every(v => v && typeof v === 'object') ? value : UNSET;
}

export const PROBES = Object.freeze({
    'model.display_name': {
        sources: [source.stdin('model.display_name')],
        coerce: asString,
        default: 'Claude',
    },
    'cwd': {
        sources: [source.stdin('cwd')],
        coerce: asString,
        default: null,
    },
    'workspace.current_dir': {
        sources: [source.stdin('workspace.current_dir')],
        coerce: asString,
        default: null,
    },
    'workspace.project_dir': {
        sources: [source.stdin('workspace.project_dir')],
        coerce: asString,
        default: null,
    },
    'workspace.git_worktree': {
        sources: [source.stdin('workspace.git_worktree')],
        coerce: asString,
        default: null,
    },
    'worktree.name': {
        sources: [source.stdin('worktree.name')],
        coerce: asString,
        default: null,
    },
    'worktree.original_branch': {
        sources: [source.stdin('worktree.original_branch')],
        coerce: asString,
        default: null,
    },
    'agent.name': {
        sources: [source.stdin('agent.name')],
        coerce: asString,
        default: null,
    },
    'vim.mode': {
        sources: [source.stdin('vim.mode')],
        coerce: asString,
        default: null,
    },
    'session_name': {
        sources: [source.stdin('session_name')],
        coerce: asString,
        default: null,
    },
    'output_style.name': {
        sources: [source.stdin('output_style.name')],
        coerce: asString,
        default: null,
    },
    'exceeds_200k_tokens': {
        sources: [source.stdin('exceeds_200k_tokens')],
        coerce: asBool,
        default: false,
    },
    'cost.total_duration_ms': {
        sources: [source.stdin('cost.total_duration_ms')],
        coerce: asInt,
        default: null,
    },
    'cost.total_cost_usd': {
        sources: [source.stdin('cost.total_cost_usd')],
        coerce: asNumber,
        default: null,
    },
    'cost.total_lines_added': {
        sources: [source.stdin('cost.total_lines_added')],
        coerce: asInt,
        default: null,
    },
    'cost.total_lines_removed': {
        sources: [source.stdin('cost.total_lines_removed')],
        coerce: asInt,
        default: null,
    },
    'context_window.remaining_percentage': {
        sources: [source.stdin('context_window.remaining_percentage')],
        coerce: asPct,
        default: null,
    },
    'context_window.used_percentage': {
        sources: [source.stdin('context_window.used_percentage')],
        coerce: asPct,
        default: null,
    },
    'context_window.total_input_tokens': {
        sources: [source.stdin('context_window.total_input_tokens')],
        coerce: asInt,
        default: null,
    },
    'context_window.total_output_tokens': {
        sources: [source.stdin('context_window.total_output_tokens')],
        coerce: asInt,
        default: null,
    },
    'context_window.context_window_size': {
        sources: [source.stdin('context_window.context_window_size')],
        coerce: asInt,
        default: 200000,
    },
    'rate_limits.five_hour.used_percentage': {
        sources: [source.stdin('rate_limits.five_hour.used_percentage')],
        coerce: asPct,
        default: null,
    },
    'rate_limits.seven_day.used_percentage': {
        sources: [source.stdin('rate_limits.seven_day.used_percentage')],
        coerce: asPct,
        default: null,
    },
    'effortLevel': {
        sources: [
            source.stdin('effortLevel'),
            source.env('CLAUDE_CODE_EFFORT_LEVEL'),
            source.settingsEnv('CLAUDE_CODE_EFFORT_LEVEL'),
        ],
        coerce: asEnum(EFFORT_LEVELS),
        default: null,
    },
    'skills': {
        sources: [source.stdin('skills')],
        coerce: asArray(),
        default: () => [],
    },
    'subagents': {
        sources: [source.stdin('subagents')],
        coerce: asObjectArray(),
        default: () => [],
    },
    'transcript_path': {
        sources: [source.stdin('transcript_path')],
        coerce: asString,
        default: null,
    },
    'version': {
        sources: [source.stdin('version')],
        coerce: asString,
        default: null,
    },
    'terminal.columns': {
        sources: [source.stdin('terminal.columns'), source.env('COLUMNS')],
        coerce: asInt,
        default: null,
    },
    'terminal.rows': {
        sources: [source.stdin('terminal.rows'), source.env('LINES')],
        coerce: asInt,
        default: null,
    },
});

function readSourceValue(sourceSpec, input, options) {
    if (sourceSpec.kind === 'stdin') return getPath(input, sourceSpec.path);
    if (sourceSpec.kind === 'env') {
        const env = options?.env ?? process.env;
        return env?.[sourceSpec.key] ?? UNSET;
    }
    if (sourceSpec.kind === 'settings-env') {
        const settingsEnv = options?.settingsEnv ?? readSettingsEnv();
        return settingsEnv?.[sourceSpec.key] ?? UNSET;
    }
    return UNSET;
}

function defaultValue(spec) {
    if (!('default' in spec)) return UNSET;
    return typeof spec.default === 'function' ? spec.default() : spec.default;
}

export function probe(path, input = {}, options = {}) {
    const spec = PROBES[path];
    if (!spec) return UNSET;
    for (const sourceSpec of spec.sources ?? []) {
        const raw = readSourceValue(sourceSpec, input, options);
        if (raw === UNSET || raw == null) continue;
        const coerced = spec.coerce ? spec.coerce(raw) : raw;
        if (coerced !== UNSET) return coerced;
    }
    return defaultValue(spec);
}
