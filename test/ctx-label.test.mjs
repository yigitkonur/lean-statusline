// Verifies show.ctxLabel = 'text' | 'icon' | 'none' modes added in 1.5.0.
// Default is 'text' → `context 32%`. 'icon' keeps the legacy `✎ 32%`.
// 'none' drops the prefix entirely.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTS } from '../lib/segments.mjs';

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
const noColorPalette = new Proxy({}, { get: () => (s) => s });

function ctxFor(mode) {
    return {
        contextPct: 32,
        cfg: { show: { ctxLabel: mode }, thresholds: { warn_at: 35, critical_at: 70 } },
        palette: noColorPalette,
        icons: { ctx: '✎' },
    };
}

test('ctx label: text mode (default) renders `context N%`', () => {
    const out = stripAnsi(SEGMENTS.ctx(ctxFor('text')));
    assert.match(out, /^context 32%$/);
});

test('ctx label: icon mode renders `✎ N%`', () => {
    const out = stripAnsi(SEGMENTS.ctx(ctxFor('icon')));
    assert.match(out, /^✎ 32%$/);
});

test('ctx label: none mode renders `N%` only', () => {
    const out = stripAnsi(SEGMENTS.ctx(ctxFor('none')));
    assert.match(out, /^32%$/);
});

test('ctx label: absent show.ctxLabel defaults to text', () => {
    const ctx = ctxFor(undefined);
    delete ctx.cfg.show.ctxLabel;
    const out = stripAnsi(SEGMENTS.ctx(ctx));
    assert.match(out, /^context 32%$/);
});
