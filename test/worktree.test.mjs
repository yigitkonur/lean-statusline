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
    const tmp = mkdtempSync(join(tmpdir(), 'lean-worktree-'));
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

function worktreeCfg(overrides = {}) {
    const cfg = structuredClone(DEFAULTS);
    cfg.segments = ['model', 'dir'];
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

const baseInput = {
    model: { display_name: 'Opus 4.7' },
    workspace: { current_dir: '/Users/me/dev/repo', project_dir: '/Users/me/dev/repo' },
};

test('worktree defaults: show.worktree is enabled by default', () => {
    assert.equal(DEFAULTS.show.worktree, true);
});

test('worktree auto-elevation: no worktree signal stays absent', () => {
    const result = render(baseInput, worktreeCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), 'Opus 4.7 · repo');
});

test('worktree auto-elevation: worktree.name inserts before dir', () => {
    const result = render({
        ...baseInput,
        worktree: { name: 'wt-login' },
    }, worktreeCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^Opus 4\.7 · 🌿 wt-login · repo$/m);
});

test('worktree auto-elevation: original branch suffix renders when present', () => {
    const result = render({
        ...baseInput,
        worktree: { name: 'my-feature', original_branch: 'main' },
    }, worktreeCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /🌿 my-feature ← main · repo$/m);
});

test('worktree auto-elevation: workspace.git_worktree is enough to render', () => {
    const result = render({
        ...baseInput,
        workspace: { ...baseInput.workspace, git_worktree: 'wt-login' },
    }, worktreeCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^Opus 4\.7 · 🌿 wt-login · repo$/m);
});

test('worktree auto-elevation: empty worktree.name falls back to workspace.git_worktree', () => {
    const result = render({
        ...baseInput,
        worktree: { name: '' },
        workspace: { ...baseInput.workspace, git_worktree: 'wt-login' },
    }, worktreeCfg());
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^Opus 4\.7 · 🌿 wt-login · repo$/m);
});

test('worktree auto-elevation: explicit worktree segment does not duplicate', () => {
    const result = render({
        ...baseInput,
        worktree: { name: 'wt-login' },
    }, worktreeCfg({ segments: ['model', 'worktree', 'dir'] }));
    assert.equal(result.status, 0, result.stderr);
    const plain = stripAnsi(result.stdout);
    assert.equal((plain.match(/wt-login/g) || []).length, 1, plain);
});

test('worktree auto-elevation: show.worktree=false suppresses even explicit worktree segments', () => {
    const result = render({
        ...baseInput,
        worktree: { name: 'wt-login' },
    }, worktreeCfg({
        segments: ['model', 'worktree', 'dir'],
        show: { worktree: false },
    }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(stripAnsi(result.stdout).trim(), 'Opus 4.7 · repo');
});

test('worktree auto-elevation: ascii mode uses <- for original branch', () => {
    const result = render({
        ...baseInput,
        worktree: { name: 'my-feature', original_branch: 'main' },
    }, worktreeCfg({ icons: 'ascii' }));
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /^Opus 4\.7 · wt my-feature <- main · repo$/m);
});
