import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULTS } from '../lib/config.mjs';
import { applyPreset } from '../lib/presets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function render(input, cfg) {
    const tmp = mkdtempSync(join(tmpdir(), 'lean-cost-'));
    const cfgPath = join(tmp, 'c.json');
    writeFileSync(cfgPath, JSON.stringify(cfg));
    const result = spawnSync(process.execPath, [BIN], {
        input: JSON.stringify(input),
        env: { ...process.env, LEAN_STATUSLINE_CONFIG: cfgPath },
        encoding: 'utf8',
        timeout: 5000,
    });
    rmSync(tmp, { recursive: true, force: true });
    return result;
}

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]\d+;[^\x07]*?\x07/g, '');

function segmentCfg(segment) {
    const cfg = applyPreset(structuredClone(DEFAULTS), 'full');
    cfg.segments = [segment];
    cfg.colors = false;
    return cfg;
}

test('cost/lines defaults: full preset ships zero-hiding conditionals', () => {
    const cfg = applyPreset(structuredClone(DEFAULTS), 'full');
    assert.deepEqual(cfg.conditionals.cost.hide_when_equals, {
        'cost.total_cost_usd': [0, null],
    });
    assert.deepEqual(cfg.conditionals.lines.hide_when_equals_all, {
        'cost.total_lines_added': [0, null],
        'cost.total_lines_removed': [0, null],
    });
});

test('cost defaults: zero usd stays hidden', () => {
    const result = render({ cost: { total_cost_usd: 0 } }, segmentCfg('cost'));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), '');
});

test('cost defaults: null usd stays hidden', () => {
    const result = render({ cost: { total_cost_usd: null } }, segmentCfg('cost'));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), '');
});

test('cost defaults: fractional usd above zero still renders', () => {
    const result = render({ cost: { total_cost_usd: 0.001 } }, segmentCfg('cost'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^\$ \$0\.00$/m);
});

test('cost defaults: positive usd still renders', () => {
    const result = render({ cost: { total_cost_usd: 1.47 } }, segmentCfg('cost'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^\$ \$1\.47$/m);
});

test('lines defaults: all-zero totals stay hidden', () => {
    const result = render({ cost: { total_lines_added: 0, total_lines_removed: 0 } }, segmentCfg('lines'));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), '');
});

test('lines defaults: partial totals stay visible', () => {
    const result = render({ cost: { total_lines_added: 0, total_lines_removed: 3 } }, segmentCfg('lines'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^-3$/m);
});
