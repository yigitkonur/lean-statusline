import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../lib/config.mjs';
import { makePalette, pickIcons } from '../lib/colors.mjs';
import { renderLine } from '../lib/segments.mjs';
import { applyLayout, displayWidth, resolveWidth, tierFor } from '../lib/layout.mjs';

function stripAnsi(value) {
    return String(value).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]\d+;[^\x07]*?\x07/g, '');
}

function makeCtx(overrides = {}) {
    return {
        input: overrides.input || {
            model: { display_name: 'Opus 4.7' },
            workspace: {
                current_dir: '/tmp/project/subdir',
                project_dir: '/tmp/project',
            },
            cost: {
                total_cost_usd: 1.5,
                total_lines_added: 12,
                total_lines_removed: 4,
            },
            terminal: { columns: 120 },
        },
        cfg: {
            ...DEFAULTS,
            segments: ['model', 'dir', 'cost', 'lines', '\n', 'rate-5h-full', 'rate-7d-full'],
            show: { ...DEFAULTS.show, branch: false, dirty: false, zap: false, bars: false },
            icons: 'ascii',
            colors: false,
            layout: {
                ...(DEFAULTS.layout || {}),
                tiers: { xl: 150, l: 100, m: 76, s: 0 },
                dropOrder: ['7d.bar', '7d.countdown', 'paceDelta', '7d.label', '7d.percent', '5h.countdown', '5h.pace', 'projectDirCrumb', 'lines', 'cost'],
                ...(overrides.layout || {}),
            },
        },
        palette: makePalette(false, 'default'),
        icons: pickIcons('ascii'),
        rateLimits: overrides.rateLimits || {
            fiveHour: { pct: 40, resetsAt: Date.now() + (2 * 60 * 60 * 1000) },
            sevenDay: { pct: 22, resetsAt: Date.now() + (4 * 24 * 60 * 60 * 1000) },
        },
        state: { lastSeen: {}, counters: { messagesSinceLastChange: {}, totalRenders: 0 } },
        transcript: null,
        dangerousPerms: false,
        effortLevel: null,
        contextPct: 14,
    };
}

test('layout: resolveWidth prefers payload, then env, then default tiering', () => {
    assert.equal(resolveWidth(makeCtx()), 120);
    assert.equal(resolveWidth(makeCtx({ input: {} }), { env: { COLUMNS: '88' } }), 88);
    assert.equal(resolveWidth(makeCtx({ input: {} }), { env: { LINES: '42' } }), 100);
    assert.equal(resolveWidth(makeCtx({ input: {} }), { env: {} }), 100);
    assert.equal(tierFor(160), 'xl');
    assert.equal(tierFor(110), 'l');
    assert.equal(tierFor(90), 'm');
    assert.equal(tierFor(60), 's');
});

test('layout: no drops on wide output and all markers are stripped', () => {
    const ctx = makeCtx();
    ctx.layoutTagged = true;
    const rendered = renderLine(ctx);
    const laidOut = applyLayout(ctx, rendered, 200);
    const plain = stripAnsi(laidOut);
    assert.match(plain, /weekly/);
    assert.doesNotMatch(laidOut, /\x1e|\x1f/);
});

test('layout: narrow widths drop 7d content first but keep the 5h percent', () => {
    const ctx = makeCtx();
    ctx.layoutTagged = true;
    const rendered = renderLine(ctx);
    const laidOut = applyLayout(ctx, rendered, 38);
    const plain = stripAnsi(laidOut);
    assert.match(plain, /current\s+40%/);
    assert.doesNotMatch(plain, /weekly/);
    assert.doesNotMatch(plain, /22%/);
    assert.doesNotMatch(plain, /\(in /);
});

test('layout: narrow header widths drop project crumbs, lines, and cost', () => {
    const ctx = makeCtx();
    ctx.layoutTagged = true;
    const rendered = renderLine(ctx);
    const laidOut = applyLayout(ctx, rendered, 24);
    const plain = stripAnsi(laidOut);
    const [header] = plain.split('\n');
    assert.match(header, /Opus 4\.7/);
    assert.match(header, /subdir/);
    assert.doesNotMatch(header, /from project/);
    assert.doesNotMatch(header, /\$1\.50/);
    assert.doesNotMatch(header, /\+12/);
  });

test('layout: displayWidth ignores ansi and counts emoji as wide glyphs', () => {
    assert.equal(displayWidth('\x1b[31mabc\x1b[0m'), 3);
    assert.equal(displayWidth('🤖×2'), 4);
});
