// Non-interactive tests for the render path (stdin → stdout pipeline).
// No PTY needed — Claude Code actually pipes stdin, so we match that mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function render(input, cfg) {
    const tmp = mkdtempSync(join(tmpdir(), 'lean-render-'));
    const cfgPath = join(tmp, 'c.json');
    writeFileSync(cfgPath, JSON.stringify(cfg));
    const r = spawnSync(process.execPath, [BIN], {
        input: JSON.stringify(input),
        env: { ...process.env, LEAN_STATUSLINE_CONFIG: cfgPath },
        encoding: 'utf8',
        timeout: 5000,
    });
    rmSync(tmp, { recursive: true, force: true });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

const minimalCfg = {
    preset: 'minimal',
    segments: ['ssh', 'model', 'ctx', 'dir', '5h', '7d'],
    show: { branch: true, dirty: true, zap: true, bars: false },
    icons: 'ascii',
    colors: false,
    separator: '·',
    contextBarWidth: 75,
    thresholds: { warn: 50, high: 70, crit: 90 },
};

const stripAnsi = s => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]\d+;[^\x07]*?\x07/g, '');

test('render: empty stdin prints placeholder', () => {
    const r = spawnSync(process.execPath, [BIN], { input: '', encoding: 'utf8', timeout: 5000 });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'Claude');
});

test('render: minimal preset with spec-shaped payload', () => {
    const r = render({
        model: { display_name: 'Opus 4.7' },
        context_window: { context_window_size: 1e6, used_percentage: 32 },
        cwd: '/tmp',
    }, minimalCfg);
    assert.equal(r.status, 0);
    const plain = stripAnsi(r.stdout);
    assert.match(plain, /Opus 4\.7/);
    assert.match(plain, /32%/);
    assert.match(plain, /tmp/);
});

test('render: session + elapsed both in segments → de-duped (0.4.5 bug fix)', () => {
    const cfg = { ...minimalCfg, segments: ['session', 'elapsed'] };
    const r = render({
        model: { display_name: 'x' },
        cost: { total_duration_ms: 2_712_000 },  // 45m 12s
        cwd: '/tmp',
    }, cfg);
    assert.equal(r.status, 0);
    const plain = stripAnsi(r.stdout);
    const matches = plain.match(/45m 12s/g) || [];
    assert.equal(matches.length, 1, `expected 1 elapsed segment, got ${matches.length}: ${plain}`);
});

test('render: resets_at as Unix seconds produces countdown (0.3.0 bug fix)', () => {
    const oneHour = 3600;
    const cfg = { ...minimalCfg, segments: ['rate-5h-full'], show: { ...minimalCfg.show, bars: true } };
    const r = render({
        model: { display_name: 'x' },
        cwd: '/tmp',
        rate_limits: {
            five_hour: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + oneHour },
        },
    }, cfg);
    assert.equal(r.status, 0);
    const plain = stripAnsi(r.stdout);
    assert.match(plain, /40%/);
    assert.match(plain, /\(in \d+[hm]/);  // countdown present
    assert.doesNotMatch(plain, /⟳/);       // absolute clock absent (0.4.3)
});

test('render: used_percentage wins over manual computation (0.3.0 bug fix)', () => {
    // Manual sum would be 20% (40k/200k); spec field says 50.
    // The ctx segment must use the spec field.
    const cfg = { ...minimalCfg, segments: ['ctx'] };
    const r = render({
        model: { display_name: 'x' },
        cwd: '/tmp',
        context_window: {
            context_window_size: 200_000,
            used_percentage: 50,
            current_usage: { input_tokens: 30_000, cache_read_input_tokens: 10_000 },
        },
    }, cfg);
    assert.equal(r.status, 0);
    const plain = stripAnsi(r.stdout);
    assert.match(plain, /50%/);
    assert.doesNotMatch(plain, /20%/);
});

test('render: effort reads from $CLAUDE_CODE_EFFORT_LEVEL, not settings.json', () => {
    const cfg = { ...minimalCfg, segments: ['effort'] };
    const tmp = mkdtempSync(join(tmpdir(), 'lean-effort-'));
    const cfgPath = join(tmp, 'c.json');
    writeFileSync(cfgPath, JSON.stringify(cfg));
    const r = spawnSync(process.execPath, [BIN], {
        input: JSON.stringify({ model: { display_name: 'x' }, cwd: '/tmp' }),
        env: {
            ...process.env,
            LEAN_STATUSLINE_CONFIG: cfgPath,
            CLAUDE_CODE_EFFORT_LEVEL: 'high',
        },
        encoding: 'utf8',
    });
    rmSync(tmp, { recursive: true, force: true });
    assert.equal(r.status, 0);
    assert.match(stripAnsi(r.stdout), /high/);
});

test('render: overflow badge shows when exceeds_200k_tokens is true', () => {
    const cfg = { ...minimalCfg, segments: ['overflow'] };
    const r = render({
        model: { display_name: 'x' }, cwd: '/tmp',
        exceeds_200k_tokens: true,
    }, cfg);
    assert.equal(r.status, 0);
    assert.match(stripAnsi(r.stdout), />200k/);
});

test('render: ssh segment silent without SSH_CONNECTION', () => {
    const cfg = { ...minimalCfg, segments: ['ssh', 'model'] };
    const r = render({ model: { display_name: 'x' }, cwd: '/tmp' }, cfg);
    const plain = stripAnsi(r.stdout);
    assert.match(plain, /x/);
    assert.doesNotMatch(plain, /SSH|🔒/);
});

test('cli: --version prints package version', () => {
    const r = spawnSync(process.execPath, [BIN, '--version'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('cli: help mentions all subcommands', () => {
    const r = spawnSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    for (const cmd of ['install', 'uninstall', 'config', 'doctor', 'selfupdate']) {
        assert.match(r.stdout, new RegExp(cmd), `help should mention ${cmd}`);
    }
});
