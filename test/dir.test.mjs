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
    const tmp = mkdtempSync(join(tmpdir(), 'lean-dir-'));
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

function dirCfg(overrides = {}) {
    const cfg = structuredClone(DEFAULTS);
    cfg.segments = ['dir'];
    cfg.colors = false;
    cfg.icons = 'unicode';
    cfg.dirStyle = 'basename';
    cfg.show = {
        ...cfg.show,
        branch: false,
        dirty: false,
        zap: false,
        ...overrides.show,
    };
    return { ...cfg, ...overrides, show: cfg.show };
}

test('dir defaults: projectDirCrumb is enabled by default', () => {
    assert.equal(DEFAULTS.show.projectDirCrumb, true);
});

test('dir drift crumb: same current_dir and project_dir stays silent', () => {
    const result = render({
        workspace: {
            current_dir: '/Users/me/dev/monorepo',
            project_dir: '/Users/me/dev/monorepo',
        },
    }, dirCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), 'monorepo');
});

test('dir drift crumb: deeper cwd shows unicode origin crumb', () => {
    const result = render({
        workspace: {
            current_dir: '/Users/me/dev/monorepo/packages/auth',
            project_dir: '/Users/me/dev/monorepo',
        },
    }, dirCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^auth ⇢ from monorepo$/m);
});

test('dir drift crumb: unrelated cwd still shows project basename', () => {
    const result = render({
        workspace: {
            current_dir: '/tmp/scratch',
            project_dir: '/Users/me/dev/monorepo',
        },
    }, dirCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^scratch ⇢ from monorepo$/m);
});

test('dir drift crumb: missing project_dir stays silent', () => {
    const result = render({
        workspace: {
            current_dir: '/tmp/scratch',
        },
    }, dirCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), 'scratch');
});

test('dir drift crumb: ascii icons use <- fallback', () => {
    const result = render({
        workspace: {
            current_dir: '/Users/me/dev/monorepo/packages/auth',
            project_dir: '/Users/me/dev/monorepo',
        },
    }, dirCfg({ icons: 'ascii' }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^auth <- from monorepo$/m);
});

test('dir drift crumb: show.projectDirCrumb=false disables the crumb', () => {
    const result = render({
        workspace: {
            current_dir: '/Users/me/dev/monorepo/packages/auth',
            project_dir: '/Users/me/dev/monorepo',
        },
    }, dirCfg({ show: { projectDirCrumb: false } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), 'auth');
});
