import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makePalette, pickIcons, applyBarStyle } from '../lib/colors.mjs';
import { renderLine } from '../lib/segments.mjs';
import { loadState } from '../lib/state.mjs';
import { DEFAULTS } from '../lib/config.mjs';

const NOW = Date.UTC(2026, 3, 18, 12, 0, 0);

function withNow(now, fn) {
    const original = Date.now;
    Date.now = () => now;
    try {
        return fn();
    } finally {
        Date.now = original;
    }
}

function makeCtx(overrides = {}) {
    const stateDir = mkdtempSync(join(tmpdir(), 'lean-rate-reset-'));
    const state = loadState('test', { dir: stateDir });
    const cfg = {
        ...structuredClone(DEFAULTS),
        segments: ['rate-5h-full'],
        colors: false,
        thresholds: { warn: 50, high: 70, crit: 90 },
        show: {
            ...structuredClone(DEFAULTS).show,
            branch: false,
            dirty: false,
            zap: false,
            bars: false,
            paceDelta: false,
        },
        rateLimit: {
            collapseMinutes: 5,
            hysteresisSeconds: 30,
            collapseColor: 'green',
            countdownUnits: 'auto',
            collapseGlyph: '↻',
        },
        ...overrides.cfg,
    };
    const ctx = {
        input: overrides.input ?? {},
        cfg,
        palette: makePalette(false),
        icons: applyBarStyle(pickIcons(cfg.icons), cfg.barStyle),
        rateLimits: { fiveHour: null, sevenDay: null, ...overrides.rateLimits },
        state,
        contextPct: null,
        dangerousPerms: false,
        effortLevel: null,
    };
    return { ctx, cleanup: () => rmSync(stateDir, { recursive: true, force: true }) };
}

test('rate reset defaults: rateLimit collapse config is enabled by default', () => {
    assert.deepEqual(DEFAULTS.rateLimit, {
        collapseMinutes: 5,
        hysteresisSeconds: 30,
        collapseColor: 'green',
        countdownUnits: 'auto',
        collapseGlyph: '↻',
    });
});

test('rate reset: normal render stays expanded above the collapse threshold', () => {
    const { ctx, cleanup } = makeCtx({
        rateLimits: {
            fiveHour: { pct: 82, resetsAt: NOW + 7 * 60 * 1000 },
        },
    });
    try {
        const rendered = withNow(NOW, () => renderLine(ctx));
        assert.equal(rendered, 'current  82% (in 7m)');
    } finally {
        cleanup();
    }
});

test('rate reset: near-reset full segments collapse to a compact cue', () => {
    const { ctx, cleanup } = makeCtx({
        rateLimits: {
            fiveHour: { pct: 82, resetsAt: NOW + 3 * 60 * 1000 },
        },
    });
    try {
        const rendered = withNow(NOW, () => renderLine(ctx));
        assert.equal(rendered, 'current ↻ 3m');
    } finally {
        cleanup();
    }
});

test('rate reset: zero remaining collapses to now', () => {
    const { ctx, cleanup } = makeCtx({
        rateLimits: {
            fiveHour: { pct: 82, resetsAt: NOW },
        },
    });
    try {
        const rendered = withNow(NOW, () => renderLine(ctx));
        assert.equal(rendered, 'current ↻ now');
    } finally {
        cleanup();
    }
});

test('rate reset: countdown formatting is unit-adaptive at the boundaries', () => {
    const { ctx, cleanup } = makeCtx({
        cfg: {
            rateLimit: {
                collapseMinutes: 0,
                hysteresisSeconds: 30,
                collapseColor: 'green',
                countdownUnits: 'auto',
                collapseGlyph: '↻',
            },
        },
    });
    try {
        const cases = [
            [59, 'current  82% (in 59s)'],
            [60, 'current  82% (in 1m)'],
            [3599, 'current  82% (in 59m)'],
            [3600, 'current  82% (in 1h00m)'],
            [86399, 'current  82% (in 23h59m)'],
            [86400, 'current  82% (in 1d0h)'],
        ];
        for (const [remainingSec, expected] of cases) {
            ctx.rateLimits.fiveHour = { pct: 82, resetsAt: NOW + remainingSec * 1000 };
            assert.equal(withNow(NOW, () => renderLine(ctx)), expected);
        }
    } finally {
        cleanup();
    }
});

test('rate reset: hysteresis keeps the collapsed cue briefly after crossing back above the threshold', () => {
    const { ctx, cleanup } = makeCtx({
        rateLimits: {
            fiveHour: { pct: 82, resetsAt: NOW + 4 * 60 * 1000 + 55 * 1000 },
        },
    });
    try {
        assert.equal(withNow(NOW, () => renderLine(ctx)), 'current ↻ 4m');
        ctx.rateLimits.fiveHour = { pct: 82, resetsAt: NOW + 5 * 60 * 1000 + 10 * 1000 };
        assert.equal(withNow(NOW, () => renderLine(ctx)), 'current ↻ 5m');
        ctx.rateLimits.fiveHour = { pct: 82, resetsAt: NOW + 5 * 60 * 1000 + 31 * 1000 };
        assert.equal(withNow(NOW, () => renderLine(ctx)), 'current  82% (in 5m)');
    } finally {
        cleanup();
    }
});
