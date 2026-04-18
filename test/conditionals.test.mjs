import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { shouldRender } from '../lib/conditionals.mjs';
import { loadState, tickState } from '../lib/state.mjs';
import { makePalette, pickIcons, applyBarStyle } from '../lib/colors.mjs';
import { renderLine } from '../lib/segments.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function makeCtx(overrides = {}) {
    const stateDir = mkdtempSync(join(tmpdir(), 'lean-cond-state-'));
    const state = loadState('test', { dir: stateDir });
    const ctx = {
        input: {},
        cfg: {
            separator: '·',
            spacing: 'normal',
            thresholds: { warn: 50, high: 70, crit: 90 },
            conditionals: {},
            segments: ['agent'],
            show: { bars: false, branch: false, dirty: false, zap: false },
        },
        palette: makePalette(false),
        icons: applyBarStyle(pickIcons('ascii'), 'ascii'),
        rateLimits: { fiveHour: null, sevenDay: null },
        state,
        contextPct: null,
        dangerousPerms: false,
        effortLevel: null,
        ...overrides,
    };
    return { ctx, cleanup: () => rmSync(stateDir, { recursive: true, force: true }) };
}

function render(input, cfg) {
    const tmp = mkdtempSync(join(tmpdir(), 'lean-conditionals-render-'));
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

test('conditionals: requires hides when a required path is absent', () => {
    const { ctx, cleanup } = makeCtx({
        input: {},
        cfg: {
            separator: '·',
            spacing: 'normal',
            thresholds: { warn: 50, high: 70, crit: 90 },
            conditionals: { agent: { requires: ['agent.name'] } },
            segments: ['agent'],
            show: { bars: false, branch: false, dirty: false, zap: false },
        },
    });
    try {
        assert.equal(shouldRender('agent', ctx), false);
        ctx.input.agent = { name: 'reviewer' };
        assert.equal(shouldRender('agent', ctx), true);
    } finally {
        cleanup();
    }
});

test('conditionals: hide_when_equals and hide_when_equals_all evaluate correctly', () => {
    const { ctx, cleanup } = makeCtx({
        input: { agent: { name: 'default' }, cost: { total_lines_added: 0, total_lines_removed: 0 } },
        cfg: {
            separator: '·',
            spacing: 'normal',
            thresholds: { warn: 50, high: 70, crit: 90 },
            conditionals: {
                agent: { hide_when_equals: { 'agent.name': ['default', 'claude'] } },
                lines: {
                    hide_when_equals_all: {
                        'cost.total_lines_added': [0, null],
                        'cost.total_lines_removed': [0, null],
                    },
                },
            },
            segments: ['agent', 'lines'],
            show: { bars: false, branch: false, dirty: false, zap: false },
        },
    });
    try {
        assert.equal(shouldRender('agent', ctx), false);
        assert.equal(shouldRender('lines', ctx), false);
        ctx.input.agent.name = 'reviewer';
        ctx.input.cost.total_lines_added = 4;
        assert.equal(shouldRender('agent', ctx), true);
        assert.equal(shouldRender('lines', ctx), true);
    } finally {
        cleanup();
    }
});

test('conditionals: max_messages hides after the configured number of unchanged renders', () => {
    const { ctx, cleanup } = makeCtx({
        input: { session_name: 'demo' },
        cfg: {
            separator: '·',
            spacing: 'normal',
            thresholds: { warn: 50, high: 70, crit: 90 },
            conditionals: {
                'session-name': { max_messages: 2, max_messages_track: 'session_name' },
            },
            segments: ['session-name'],
            show: { bars: false, branch: false, dirty: false, zap: false },
        },
    });
    try {
        tickState(ctx.state, { session_name: 'demo' });
        assert.equal(shouldRender('session-name', ctx), true);
        tickState(ctx.state, { session_name: 'demo' });
        assert.equal(shouldRender('session-name', ctx), true);
        tickState(ctx.state, { session_name: 'demo' });
        assert.equal(shouldRender('session-name', ctx), false);
    } finally {
        cleanup();
    }
});

test('conditionals: detect_files resolves relative to the effective cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'lean-cond-files-'));
    const cwd = join(root, 'repo');
    const marker = join(cwd, '.git', 'MERGE_HEAD');
    try {
        mkdirSync(join(cwd, '.git'), { recursive: true });
        const { ctx, cleanup } = makeCtx({
            input: { workspace: { current_dir: cwd } },
            cfg: {
                separator: '·',
                spacing: 'normal',
                thresholds: { warn: 50, high: 70, crit: 90 },
                conditionals: { overflow: { detect_files: ['.git/MERGE_HEAD'] } },
                segments: ['overflow'],
                show: { bars: false, branch: false, dirty: false, zap: false },
            },
        });
        try {
            assert.equal(shouldRender('overflow', ctx), false);
            writeFileSync(marker, 'merge');
            assert.equal(shouldRender('overflow', ctx), true);
        } finally {
            cleanup();
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('renderLine: conditionals can hide a segment without changing the segment implementation', () => {
    const { ctx, cleanup } = makeCtx({
        input: { agent: { name: 'default' } },
        cfg: {
            separator: '·',
            spacing: 'normal',
            thresholds: { warn: 50, high: 70, crit: 90 },
            conditionals: { agent: { hide_when_equals: { 'agent.name': ['default'] } } },
            segments: ['agent'],
            show: { bars: false, branch: false, dirty: false, zap: false },
        },
    });
    try {
        assert.equal(renderLine(ctx), '');
    } finally {
        cleanup();
    }
});

test('render: configured conditionals hide noise values in the CLI render path', () => {
    const cfg = {
        preset: 'full',
        segments: ['agent'],
        show: { branch: false, dirty: false, zap: false, bars: false },
        icons: 'ascii',
        colors: false,
        separator: '·',
        contextBarWidth: 75,
        thresholds: { warn: 50, high: 70, crit: 90 },
        conditionals: {
            agent: { hide_when_equals: { 'agent.name': ['default', 'claude'] } },
        },
    };
    const hidden = render({ agent: { name: 'default' } }, cfg);
    assert.equal(hidden.status, 0);
    assert.equal(hidden.stdout.trim(), '');

    const shown = render({ agent: { name: 'reviewer' } }, cfg);
    assert.equal(shown.status, 0);
    assert.match(shown.stdout, /reviewer/);
});
