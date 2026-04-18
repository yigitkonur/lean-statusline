import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../lib/config.mjs';
import { makePalette, pickIcons } from '../lib/colors.mjs';
import { PRESETS } from '../lib/presets.mjs';
import { renderLine } from '../lib/segments.mjs';

function stripAnsi(value) {
    return String(value).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]\d+;[^\x07]*?\x07/g, '');
}

function makeCtx(input = {}, overrides = {}) {
    return {
        input,
        cfg: {
            ...DEFAULTS,
            segments: ['model', 'subagents'],
            show: { ...DEFAULTS.show, subagents: true, bars: false },
            subagents: { ...DEFAULTS.subagents, ...overrides.subagents },
        },
        palette: makePalette(false, 'default'),
        icons: pickIcons(overrides.icons || 'unicode'),
        rateLimits: {},
        state: { lastSeen: {}, counters: { messagesSinceLastChange: {}, totalRenders: 0 } },
        transcript: overrides.transcript || null,
        dangerousPerms: false,
        effortLevel: null,
        contextPct: null,
    };
}

test('subagents defaults: compact/full enable the segment and minimal leaves it off', () => {
    assert.equal(DEFAULTS.show.subagents, true);
    assert.equal(PRESETS.minimal.config.show.subagents, false);
    assert.ok(PRESETS.compact.config.segments.includes('subagents'));
    assert.ok(PRESETS.full.config.segments.includes('subagents'));
    assert.equal(PRESETS.minimal.config.segments.includes('subagents'), false);
});

test('subagents: hidden when there are no active native or transcript agents', () => {
    const plain = stripAnsi(renderLine(makeCtx({ model: { display_name: 'Opus 4.7' }, subagents: [] })));
    assert.equal(plain, 'Opus 4.7');
});

test('subagents: native payload wins and filters to running agents only', () => {
    const plain = stripAnsi(renderLine(makeCtx({
        model: { display_name: 'Opus 4.7' },
        subagents: [
            { name: 'review', status: 'running' },
            { name: 'test', status: 'completed' },
            { name: 'research', status: 'running' },
        ],
    })));
    assert.match(plain, /🤖×2/);
    assert.doesNotMatch(plain, /test/);
});

test('subagents: showNames clamps the visible list and appends an ellipsis', () => {
    const plain = stripAnsi(renderLine(makeCtx({
        model: { display_name: 'Opus 4.7' },
        subagents: [
            { name: 'research', status: 'running' },
            { name: 'review', status: 'running' },
            { name: 'test', status: 'running' },
        ],
    }, {
        subagents: { showNames: true, maxNames: 2 },
    })));
    assert.match(plain, /🤖×3 \(research, review\.\.\.\)/);
});

test('subagents: transcript fallback is used when the native field is absent', () => {
    const plain = stripAnsi(renderLine(makeCtx({ model: { display_name: 'Opus 4.7' } }, {
        transcript: {
            subagents: {
                a: { name: 'research', startedAt: 1 },
                b: { name: 'review', startedAt: 2 },
            },
        },
    })));
    assert.match(plain, /🤖×2/);
});

test('subagents: ascii mode uses agents:N instead of the robot glyph', () => {
    const plain = stripAnsi(renderLine(makeCtx({
        model: { display_name: 'Opus 4.7' },
        subagents: [{ name: 'review', status: 'running' }],
    }, { icons: 'ascii' })));
    assert.match(plain, /agents:1/);
});
