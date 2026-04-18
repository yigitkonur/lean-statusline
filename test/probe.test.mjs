import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { probe, UNSET } from '../lib/probe.mjs';
import { readContextPct, resolveEffortLevel } from '../lib/segments.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function render(input, cfg) {
    const tmp = mkdtempSync(join(tmpdir(), 'lean-probe-render-'));
    const cfgPath = join(tmp, 'c.json');
    writeFileSync(cfgPath, JSON.stringify(cfg));
    const r = spawnSync(process.execPath, [BIN], {
        input: JSON.stringify(input),
        env: { ...process.env, LEAN_STATUSLINE_CONFIG: cfgPath },
        encoding: 'utf8',
        timeout: 5000,
    });
    rmSync(tmp, { recursive: true, force: true });
    return r;
}

const minimalCfg = {
    preset: 'minimal',
    segments: ['model', 'ctx', 'dir', 'effort'],
    show: { branch: false, dirty: false, zap: false, bars: false },
    icons: 'ascii',
    colors: false,
    separator: '·',
    contextBarWidth: 75,
    thresholds: { warn: 50, high: 70, crit: 90 },
};

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]\d+;[^\x07]*?\x07/g, '');

const fixtureDir = join(__dirname, 'fixtures', 'payloads');

test('probe: unknown paths return UNSET', () => {
    assert.equal(probe('does.not.exist', {}), UNSET);
});

test('probe: effortLevel prefers stdin, then env, then settings', () => {
    assert.equal(probe('effortLevel', { effortLevel: 'medium' }, {
        env: { CLAUDE_CODE_EFFORT_LEVEL: 'low' },
        settingsEnv: { CLAUDE_CODE_EFFORT_LEVEL: 'high' },
    }), 'medium');

    assert.equal(probe('effortLevel', {}, {
        env: { CLAUDE_CODE_EFFORT_LEVEL: 'low' },
        settingsEnv: { CLAUDE_CODE_EFFORT_LEVEL: 'high' },
    }), 'low');

    assert.equal(probe('effortLevel', {}, {
        env: {},
        settingsEnv: { CLAUDE_CODE_EFFORT_LEVEL: 'high' },
    }), 'high');
});

test('probe: terminal columns and payload arrays coerce safely', () => {
    assert.equal(probe('terminal.columns', { terminal: { columns: '132' } }), 132);
    assert.equal(probe('terminal.rows', { terminal: { rows: '42' } }), 42);
    assert.deepEqual(probe('skills', { skills: ['plan', 'code'] }), ['plan', 'code']);
    assert.deepEqual(probe('subagents', {}), []);
});

test('readContextPct: prefers precomputed value, falls back to legacy math', () => {
    assert.equal(readContextPct({
        context_window: {
            context_window_size: 200000,
            used_percentage: 50,
            current_usage: { input_tokens: 30000, cache_read_input_tokens: 10000 },
        },
    }), 50);

    assert.equal(readContextPct({
        context_window: {
            context_window_size: 200000,
            current_usage: { input_tokens: 30000, cache_read_input_tokens: 10000 },
        },
    }), 20);
});

test('resolveEffortLevel: uses shipped input field before env/settings fallbacks', () => {
    assert.equal(resolveEffortLevel({ effortLevel: 'medium' }, {
        env: { CLAUDE_CODE_EFFORT_LEVEL: 'low' },
        settingsEnv: { CLAUDE_CODE_EFFORT_LEVEL: 'high' },
    }), 'medium');
});

test('render: effort segment reads input.effortLevel from stdin payload', () => {
    const r = render({
        model: { display_name: 'Opus 4.7' },
        cwd: '/tmp/project',
        context_window: { context_window_size: 1000000, used_percentage: 10 },
        effortLevel: 'high',
    }, minimalCfg);
    assert.equal(r.status, 0);
    assert.match(stripAnsi(r.stdout), /high/);
});

test('fixture corpus: representative payload versions render without crashing', () => {
    for (const name of ['2.1.80', '2.1.90', '2.1.100', '2.1.109']) {
        const path = join(fixtureDir, `${name}.json`);
        const payload = JSON.parse(readFileSync(path, 'utf8'));
        const r = render(payload, minimalCfg);
        assert.equal(r.status, 0, `${name}: ${r.stderr}`);
        assert.notEqual(stripAnsi(r.stdout).trim(), '', `${name}: expected visible output`);
    }
});
