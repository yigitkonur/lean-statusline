// Verifies the ellipsis-truncation fallback added to applyLayout in 1.5.0.
// After the drop-ladder exhausts tagged sections, any line still wider than
// the terminal gets truncated with a trailing `…`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLayout, stripAnsi, displayWidth } from '../lib/layout.mjs';

function ctxWithSeparator() {
    return {
        cfg: { separator: '·', spacing: 'normal', layout: { dropOrder: [] } },
        palette: { dim: (s) => s },
    };
}

test('ellipsis: short line untouched', () => {
    const ctx = ctxWithSeparator();
    const out = applyLayout(ctx, 'short', 20);
    assert.equal(out, 'short');
    assert.ok(!out.includes('…'));
});

test('ellipsis: long line truncated to width with trailing …', () => {
    const ctx = ctxWithSeparator();
    const line = 'abcdefghijklmnopqrstuvwxyz';
    const out = applyLayout(ctx, line, 10);
    const plain = stripAnsi(out);
    assert.ok(plain.length <= 10, `got ${plain.length}: ${plain}`);
    assert.ok(plain.endsWith('…'), `should end with …: ${plain}`);
});

test('ellipsis: multi-line output truncates each line independently', () => {
    const ctx = ctxWithSeparator();
    const text = ['line-one-is-too-long-for-twelve', 'fits', 'another-overlong-line-text'].join('\n');
    const out = applyLayout(ctx, text, 12);
    const lines = stripAnsi(out).split('\n');
    assert.equal(lines.length, 3);
    assert.ok(lines[0].endsWith('…'));
    assert.equal(lines[1], 'fits');
    assert.ok(lines[2].endsWith('…'));
});

test('ellipsis: ANSI colors are preserved, visible-width counted', () => {
    const ctx = ctxWithSeparator();
    // `\x1b[31m` is 5 raw chars but 0 visible cells.
    const colored = '\x1b[31mabcdefghij\x1b[0m';
    const out = applyLayout(ctx, colored, 6);
    // Visible width should be <= 6 even though raw string is longer.
    assert.ok(displayWidth(out) <= 6);
    assert.ok(stripAnsi(out).endsWith('…'));
});

test('ellipsis: width=1 produces empty string (no room for ellipsis)', () => {
    const ctx = ctxWithSeparator();
    const out = applyLayout(ctx, 'abc', 1);
    assert.equal(out, '');
});
