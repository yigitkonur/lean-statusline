// Verifies the 5h/7d ↔ rate-5h-full/rate-7d-full dedup added in 1.5.0.
// User hit a bug where enabling both in the wizard produced a duplicate
// rate-limit row. RATE_DEDUP_PAIRS in segments.mjs drops the compact form
// when the full form is also present; standalone compact still works.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLine } from '../lib/segments.mjs';
import { DEFAULTS } from '../lib/config.mjs';

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

function makeCtx(segments) {
    return {
        input: {},
        cfg: { ...DEFAULTS, segments, colors: false, show: { ...DEFAULTS.show, bars: true }, spacing: 'normal', separator: '·' },
        palette: new Proxy({}, { get: () => (s) => s }),
        icons: { ctx: '✎', barFilled: '●', barEmpty: '○', rail: '─' },
        rateLimits: {
            fiveHour: { pct: 40, resetsAt: Date.now() + 90 * 60 * 1000 },
            sevenDay: { pct: 20, resetsAt: Date.now() + 3 * 24 * 60 * 60 * 1000 },
        },
        contextPct: 32,
        dangerousPerms: false,
    };
}

test('rate dedup: 5h alone renders compact form', () => {
    const ctx = makeCtx(['5h']);
    const out = stripAnsi(renderLine(ctx));
    assert.match(out, /5h/);
    assert.doesNotMatch(out, /current/);
});

test('rate dedup: rate-5h-full alone renders full form', () => {
    const ctx = makeCtx(['rate-5h-full']);
    const out = stripAnsi(renderLine(ctx));
    assert.match(out, /current/);
    assert.doesNotMatch(out, /^5h /m);
});

test('rate dedup: both 5h AND rate-5h-full renders only rate-5h-full (full wins)', () => {
    const ctx = makeCtx(['5h', 'rate-5h-full']);
    const out = stripAnsi(renderLine(ctx));
    // Should NOT have two rate-limit rows for the 5h window.
    assert.match(out, /current/);
    const occurrences = (out.match(/40%/g) || []).length;
    assert.equal(occurrences, 1, `expected exactly one 40% render, got ${occurrences}: ${out}`);
});

test('rate dedup: 7d + rate-7d-full also dedups to the full form', () => {
    const ctx = makeCtx(['7d', 'rate-7d-full']);
    const out = stripAnsi(renderLine(ctx));
    assert.match(out, /weekly/);
    const occurrences = (out.match(/20%/g) || []).length;
    assert.equal(occurrences, 1);
});
