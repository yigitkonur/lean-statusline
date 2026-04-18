import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    statePath,
    loadState,
    saveState,
    tickState,
    changedSince,
    listStateFiles,
    cleanStateFiles,
} from '../lib/state.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');
const DEFAULT_CFG = {
    preset: 'minimal',
    segments: ['model'],
    show: { branch: false, dirty: false, zap: false, bars: false },
    icons: 'ascii',
    colors: false,
    separator: '·',
    contextBarWidth: 75,
    thresholds: { warn: 50, high: 70, crit: 90 },
};

function makeStateDir() {
    return mkdtempSync(join(tmpdir(), 'lean-state-'));
}

function withConfigDir(fn) {
    const cfgDir = mkdtempSync(join(tmpdir(), 'lean-state-render-'));
    const cfgPath = join(cfgDir, 'config.json');
    writeFileSync(cfgPath, JSON.stringify(DEFAULT_CFG));
    try {
        return fn(cfgPath);
    } finally {
        rmSync(cfgDir, { recursive: true, force: true });
    }
}

function renderOnce(sessionId, stateDir) {
    return withConfigDir((cfgPath) => spawnSync(process.execPath, [BIN], {
        input: JSON.stringify({
            session_id: sessionId,
            model: { display_name: 'Opus 4.7' },
            context_window: { context_window_size: 1000000, used_percentage: 12 },
            agent: { name: 'default' },
            session_name: 'demo',
        }),
        env: {
            ...process.env,
            LEAN_STATUSLINE_CONFIG: cfgPath,
            LEAN_STATUSLINE_STATE_DIR: stateDir,
        },
        encoding: 'utf8',
        timeout: 5000,
    }));
}

function spawnRender(sessionId, stateDir) {
    return withConfigDir((cfgPath) => new Promise((resolvePromise) => {
        const child = spawn(process.execPath, [BIN], {
            env: {
                ...process.env,
                LEAN_STATUSLINE_CONFIG: cfgPath,
                LEAN_STATUSLINE_STATE_DIR: stateDir,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('close', (code) => resolvePromise({ code, stderr }));
        child.stdin.end(JSON.stringify({
            session_id: sessionId,
            model: { display_name: 'Opus 4.7' },
            context_window: { context_window_size: 1000000, used_percentage: 12 },
        }));
    }));
}

test('state: missing files return a fresh state', () => {
    const dir = makeStateDir();
    try {
        const state = loadState('demo', { dir });
        assert.equal(state.schemaVersion, 1);
        assert.deepEqual(state.lastSeen, {});
        assert.equal(state.counters.totalRenders, 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('state: corrupt files fall back to fresh state without throwing', () => {
    const dir = makeStateDir();
    try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(statePath('demo', { dir }), '{not json');
        const state = loadState('demo', { dir });
        assert.equal(state.schemaVersion, 1);
        assert.deepEqual(state.lastSeen, {});
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('state: tickState resets counters on change and increments on steady values', () => {
    const dir = makeStateDir();
    try {
        const state = loadState('demo', { dir });
        tickState(state, { 'agent.name': 'default' });
        assert.equal(state.counters.messagesSinceLastChange['agent.name'], 0);

        tickState(state, { 'agent.name': 'default' });
        assert.equal(state.counters.messagesSinceLastChange['agent.name'], 1);

        tickState(state, { 'agent.name': 'reviewer' });
        assert.equal(state.counters.messagesSinceLastChange['agent.name'], 0);
        assert.equal(state.lastSeen['agent.name'], 'reviewer');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('state: changedSince is true only on the first render after a change', () => {
    const dir = makeStateDir();
    try {
        const state = loadState('demo', { dir });
        tickState(state, { 'session_name': 'one' });
        assert.equal(changedSince(state, 'session_name'), false);

        tickState(state, { 'session_name': 'one' });
        assert.equal(changedSince(state, 'session_name'), false);

        tickState(state, { 'session_name': 'two' });
        assert.equal(changedSince(state, 'session_name'), true);

        tickState(state, { 'session_name': 'two' });
        assert.equal(changedSince(state, 'session_name'), false);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('state: save/load round-trip and cleanup helpers work', () => {
    const dir = makeStateDir();
    try {
        const state = loadState('demo', { dir });
        tickState(state, { 'agent.name': 'reviewer' });
        saveState('demo', state, { dir });

        const loaded = loadState('demo', { dir });
        assert.equal(loaded.lastSeen['agent.name'], 'reviewer');
        assert.equal(listStateFiles({ dir }).length, 1);
        assert.equal(cleanStateFiles({ dir }), 1);
        assert.equal(listStateFiles({ dir }).length, 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('state integration: repeated renders advance a per-session file', () => {
    const dir = makeStateDir();
    try {
        const first = renderOnce('demo-session', dir);
        assert.equal(first.status, 0, first.stderr);
        const second = renderOnce('demo-session', dir);
        assert.equal(second.status, 0, second.stderr);

        const persisted = JSON.parse(readFileSync(statePath('demo-session', { dir }), 'utf8'));
        assert.equal(persisted.counters.totalRenders, 2);
        assert.equal(persisted.counters.messagesSinceLastChange['agent.name'], 1);
        assert.equal(persisted.counters.messagesSinceLastChange['session_name'], 1);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('state integration: parallel renders with the same session_id do not throw', async () => {
    const dir = makeStateDir();
    try {
        const [a, b] = await Promise.all([
            spawnRender('parallel-session', dir),
            spawnRender('parallel-session', dir),
        ]);
        assert.equal(a.code, 0, a.stderr);
        assert.equal(b.code, 0, b.stderr);
        assert.equal(listStateFiles({ dir }).length, 1);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
