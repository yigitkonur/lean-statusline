import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCHEMA_VERSION = 1;
const STATE_FILE_PREFIX = 'lean-statusline-state-';
const STATE_FILE_SUFFIX = '.json';
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function stateDir(options = {}) {
    return options.dir || process.env.LEAN_STATUSLINE_STATE_DIR || tmpdir();
}

function freshState(now = Date.now()) {
    return {
        schemaVersion: SCHEMA_VERSION,
        lastSeen: {},
        counters: {
            messagesSinceLastChange: {},
            totalRenders: 0,
            firstSeenAt: now,
            lastRenderAt: now,
        },
    };
}

export function statePath(sessionId, options = {}) {
    const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    return join(stateDir(options), `${STATE_FILE_PREFIX}${safe}${STATE_FILE_SUFFIX}`);
}

export function loadState(sessionId, options = {}) {
    const path = statePath(sessionId, options);
    if (!existsSync(path)) return freshState();
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (parsed?.schemaVersion !== SCHEMA_VERSION) return freshState();
        return parsed;
    } catch {
        return freshState();
    }
}

export function saveState(sessionId, state, options = {}) {
    const path = statePath(sessionId, options);
    try {
        mkdirSync(stateDir(options), { recursive: true });
        writeFileSync(path, JSON.stringify(state), 'utf8');
    } catch {
        // Non-fatal: the statusline should render even when persistence fails.
    }
}

export function tickState(state, probes) {
    for (const [key, value] of Object.entries(probes)) {
        const prev = state.lastSeen[key];
        if (prev === value) {
            state.counters.messagesSinceLastChange[key] = (state.counters.messagesSinceLastChange[key] ?? 0) + 1;
        } else {
            state.lastSeen[key] = value;
            state.counters.messagesSinceLastChange[key] = 0;
        }
    }
    state.counters.totalRenders += 1;
    state.counters.lastRenderAt = Date.now();
    return state;
}

export function changedSince(state, key) {
    return (state.counters.messagesSinceLastChange[key] ?? 0) === 0 && state.counters.totalRenders > 1;
}

export function listStateFiles(options = {}) {
    const dir = stateDir(options);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter(name => name.startsWith(STATE_FILE_PREFIX) && name.endsWith(STATE_FILE_SUFFIX))
        .map(name => {
            const path = join(dir, name);
            const ageMs = Date.now() - statSync(path).mtimeMs;
            return { name, path, ageMs, stale: ageMs > STALE_AFTER_MS };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function cleanStateFiles(options = {}) {
    let removed = 0;
    for (const file of listStateFiles(options)) {
        if (options.staleOnly && !file.stale) continue;
        rmSync(file.path, { force: true });
        removed += 1;
    }
    return removed;
}
