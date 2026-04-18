import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULTS } from '../lib/config.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function render(input, cfg) {
    const tmp = mkdtempSync(join(tmpdir(), 'lean-pace-render-'));
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

function rateCfg(segment, overrides = {}) {
    const cfg = structuredClone(DEFAULTS);
    cfg.segments = [segment];
    cfg.colors = false;
    cfg.show = {
        ...cfg.show,
        branch: false,
        dirty: false,
        zap: false,
        bars: false,
        ...overrides.show,
    };
    cfg.pace = {
        fastBand: 5,
        slowBand: -5,
        suppressBelow: 2,
        ...overrides.pace,
    };
    return { ...cfg, ...overrides, show: cfg.show, pace: cfg.pace };
}

const nowSec = () => Math.floor(Date.now() / 1000);

test('pace render defaults: show.paceDelta and pace bands are enabled by default', () => {
    assert.equal(DEFAULTS.show.paceDelta, true);
    assert.deepEqual(DEFAULTS.pace, {
        fastBand: 5,
        slowBand: -5,
        suppressBelow: 2,
    });
});

test('pace render: inline 5h segment appends a fast unicode delta', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('5h'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^5h 60% ⇡\+20$/m);
});

test('pace render: inline 7d segment appends a slow unicode delta', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 1, resets_at: nowSec() + (5 * 60 * 60) },
            seven_day: { used_percentage: 10, resets_at: nowSec() + (4 * 24 * 60 * 60) },
        },
    }, rateCfg('7d'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^7d 10% ⇣-33$/m);
});

test('pace render: neutral or suppressed pace stays hidden', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 1, resets_at: nowSec() + (5 * 60 * 60) - Math.round(0.02 * 5 * 60 * 60) },
        },
    }, rateCfg('5h'));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), '5h 1%');
});

test('pace render: full rate segment inserts the pace delta before countdown', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('rate-5h-full'));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^current  60% ⇡\+20 \(in \d+h\d\dm\)$/m);
});

test('pace render: show.paceDelta=false hides the delta even when pace is fast', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('5h', { show: { paceDelta: false } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), '5h 60%');
});

test('pace render: ascii icons use ^ and v arrows', () => {
    const fast = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('5h', { icons: 'ascii' }));
    assert.equal(fast.status, 0, fast.stderr);
    assert.match(stripAnsi(fast.stdout), /^5h 60% \^\+20$/m);

    const slow = render({
        rate_limits: {
            five_hour: { used_percentage: 1, resets_at: nowSec() + (5 * 60 * 60) },
            seven_day: { used_percentage: 10, resets_at: nowSec() + (4 * 24 * 60 * 60) },
        },
    }, rateCfg('7d', { icons: 'ascii' }));
    assert.equal(slow.status, 0, slow.stderr);
    assert.match(stripAnsi(slow.stdout), /^7d 10% v-33$/m);
});
