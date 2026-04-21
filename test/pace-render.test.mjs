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
    assert.equal(DEFAULTS.pace.fastBand, 5);
    assert.equal(DEFAULTS.pace.slowBand, -5);
    assert.equal(DEFAULTS.pace.suppressBelow, 2);
    assert.equal(DEFAULTS.pace.mode, 'eta');
});

test('pace render: inline 5h segment appends a fast unicode delta (mode=delta)', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('5h', { pace: { mode: 'delta' } }));
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

test('pace render: rate-5h-full with mode=delta keeps legacy ⇡+N arrow', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('rate-5h-full', { pace: { mode: 'delta' } }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^current  60% ⇡\+20 \(in \d+h\d\dm\)$/m);
});

test('pace render: show.paceDelta=false hides the delta even when pace is fast', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('5h', { show: { paceDelta: false }, pace: { mode: 'delta' } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), '5h 60%');
});

test('pace render: ascii icons use ^ and v arrows (mode=delta)', () => {
    const fast = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('5h', { icons: 'ascii', pace: { mode: 'delta' } }));
    assert.equal(fast.status, 0, fast.stderr);
    assert.match(stripAnsi(fast.stdout), /^5h 60% \^\+20$/m);

    const slow = render({
        rate_limits: {
            five_hour: { used_percentage: 1, resets_at: nowSec() + (5 * 60 * 60) },
            seven_day: { used_percentage: 10, resets_at: nowSec() + (4 * 24 * 60 * 60) },
        },
    }, rateCfg('7d', { icons: 'ascii', pace: { mode: 'delta' } }));
    assert.equal(slow.status, 0, slow.stderr);
    assert.match(stripAnsi(slow.stdout), /^7d 10% v-33$/m);
});

// ── ETA mode (new default) ─────────────────────────────

test('pace render: rate-5h-full ETA mode swaps ⇡+N for "vs est:" when urgent', () => {
    // 1h into window (20% elapsed), 50% used → burn 50%/h → eta 1h, reset in 4h.
    // exhaustsBeforeReset = true, so we should see "vs est:" and no delta arrow.
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 50, resets_at: nowSec() + (4 * 60 * 60) },
        },
    }, rateCfg('rate-5h-full'));
    assert.equal(result.status, 0, result.stderr);
    const clean = stripAnsi(result.stdout);
    assert.match(clean, /^current  50% \(in \d+h\d\dm vs est: \d+h\d\dm\)$/m);
    assert.ok(!/⇡/.test(clean), 'delta arrow should be absent in ETA mode');
});

test('pace render: rate-5h-full ETA mode falls back to plain countdown when not urgent', () => {
    // 5% used after 1h of a 5h window → not urgent, plain (in …) only.
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 5, resets_at: nowSec() + (4 * 60 * 60) },
        },
    }, rateCfg('rate-5h-full'));
    assert.equal(result.status, 0, result.stderr);
    const clean = stripAnsi(result.stdout);
    assert.match(clean, /^current   5% \(in \d+h\d\dm\)$/m);
    assert.ok(!/vs est:/.test(clean), '"vs est:" should be absent when not urgent');
});

test('pace render: 7d row keeps delta arrow regardless of mode=eta', () => {
    // ETA mode is 5h-only; 7d should still get its ⇡+N delta when fast.
    // `five_hour` stub is required so getRateLimits takes the stdin path and
    // doesn't fall through to the developer's real cached usage.
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 0, resets_at: nowSec() + (5 * 60 * 60) },
            seven_day: { used_percentage: 50, resets_at: nowSec() + (4 * 24 * 60 * 60) },
        },
    }, rateCfg('rate-7d-full'));
    assert.equal(result.status, 0, result.stderr);
    const clean = stripAnsi(result.stdout);
    assert.match(clean, /weekly  50% ⇡\+/);
});

test('pace render: LEAN_STATUSLINE_PACE_PREVIEW forces "vs est:" even when not urgent', () => {
    const cfg = rateCfg('rate-5h-full');
    const tmp = mkdtempSync(join(tmpdir(), 'lean-pace-preview-'));
    const cfgPath = join(tmp, 'c.json');
    writeFileSync(cfgPath, JSON.stringify(cfg));
    const result = spawnSync(process.execPath, [BIN], {
        input: JSON.stringify({
            rate_limits: {
                five_hour: { used_percentage: 5, resets_at: nowSec() + (4 * 60 * 60) },
            },
        }),
        env: { ...process.env, LEAN_STATUSLINE_CONFIG: cfgPath, LEAN_STATUSLINE_PACE_PREVIEW: '1' },
        encoding: 'utf8',
        timeout: 5000,
    });
    rmSync(tmp, { recursive: true, force: true });
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /vs est:/);
});

test('pace render: mode=off hides both delta and ETA', () => {
    const result = render({
        rate_limits: {
            five_hour: { used_percentage: 60, resets_at: nowSec() + (3 * 60 * 60) },
        },
    }, rateCfg('5h', { pace: { mode: 'off' } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), '5h 60%');
});
