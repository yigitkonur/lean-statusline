// Covers the pace-explainer segment: unit-level tests against renderPaceExplainer
// imported directly from segments.mjs (rather than spawning the bin, which makes
// state-transition scenarios easier to set up deterministically).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTS } from '../lib/segments.mjs';
import { DEFAULTS } from '../lib/config.mjs';

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]\d+;[^\x07]*?\x07/g, '');

function makeCtx({ pct = 50, resetsInSec = 4 * 60 * 60, lastSeen = {}, mode = 'eta', preview = false } = {}) {
    const palette = {
        red: (s) => s, orange: (s) => s, green: (s) => s, yellow: (s) => s,
        cyan: (s) => s, blue: (s) => s, magenta: (s) => s, white: (s) => s,
        dim: (s) => s, reset: '', clr: '',
    };
    return {
        palette,
        icons: { ctx: '✎', warn: '⚠' },
        rateLimits: {
            fiveHour: { pct, resetsAt: Date.now() + resetsInSec * 1000 },
        },
        cfg: {
            ...DEFAULTS,
            pace: { ...DEFAULTS.pace, mode },
            show: { ...DEFAULTS.show, paceDelta: true },
        },
        state: { lastSeen: { ...lastSeen } },
        pacePreview: preview,
    };
}

test('pace-explainer: silent when not urgent', () => {
    // 5% usage after 1h of 5h window — burn is slow, no exhaustion before reset.
    const ctx = makeCtx({ pct: 5, resetsInSec: 4 * 60 * 60 });
    const out = SEGMENTS['pace-explainer'](ctx);
    assert.equal(out, null);
});

test('pace-explainer: silent when pace.explainer=false', () => {
    const ctx = makeCtx({ pct: 60, resetsInSec: 3 * 60 * 60 });
    ctx.cfg.pace.explainer = false;
    const out = SEGMENTS['pace-explainer'](ctx);
    assert.equal(out, null);
});

test('pace-explainer: silent when mode=delta or mode=off', () => {
    for (const mode of ['delta', 'off']) {
        const ctx = makeCtx({ pct: 60, resetsInSec: 3 * 60 * 60, mode });
        assert.equal(SEGMENTS['pace-explainer'](ctx), null, `mode=${mode}`);
    }
});

test('pace-explainer: first urgency renders the "first" copy', () => {
    // 1h into 5h window (20% elapsed), 50% used → eta=1h < reset=4h → urgent.
    const ctx = makeCtx({ pct: 50, resetsInSec: 4 * 60 * 60 });
    const out = stripAnsi(SEGMENTS['pace-explainer'](ctx));
    assert.match(out, /^⚠ At this pace, 5h cap hits in \d+h\d\dm \(resets in \d+h\d\dm\)$/);
    // State should record shownAt + lastEtaMs for the next render.
    assert.ok(ctx.state.lastSeen.paceExplainerShownAt > 0);
    assert.ok(ctx.state.lastSeen.paceExplainerLastEtaMs > 0);
});

test('pace-explainer: hidden while within interval but past duration', () => {
    const ctx = makeCtx({ pct: 50, resetsInSec: 4 * 60 * 60 });
    // Pretend it was shown 30s ago (past 10s duration, well under 10min interval).
    ctx.state.lastSeen.paceExplainerShownAt = Date.now() - 30_000;
    ctx.state.lastSeen.paceExplainerLastEtaMs = 60 * 60 * 1000;
    const out = SEGMENTS['pace-explainer'](ctx);
    assert.equal(out, null);
});

test('pace-explainer: re-opens show window after interval elapses', () => {
    const ctx = makeCtx({ pct: 50, resetsInSec: 4 * 60 * 60 });
    ctx.state.lastSeen.paceExplainerShownAt = Date.now() - 601_000; // > 10min
    ctx.state.lastSeen.paceExplainerLastEtaMs = 60 * 60 * 1000;
    const out = SEGMENTS['pace-explainer'](ctx);
    assert.ok(out, 'should render after interval');
    assert.ok(stripAnsi(out).startsWith('⚠'));
});

test('pace-explainer: "faster" copy when eta shrinks vs last render', () => {
    const ctx = makeCtx({ pct: 50, resetsInSec: 4 * 60 * 60 });
    // eta will be ~1h (3_600_000ms). Last eta was 2h (7_200_000). Trend = faster.
    ctx.state.lastSeen.paceExplainerShownAt = Date.now() - 601_000;  // trigger re-open
    ctx.state.lastSeen.paceExplainerLastEtaMs = 2 * 60 * 60 * 1000;
    const out = stripAnsi(SEGMENTS['pace-explainer'](ctx));
    assert.match(out, /Pace sped up — 5h cap now in \d+h\d\dm \(was 2h00m, resets in \d+h\d\dm\)/);
});

test('pace-explainer: "slower" copy when eta grows vs last render', () => {
    const ctx = makeCtx({ pct: 50, resetsInSec: 4 * 60 * 60 });
    // eta will be ~1h. Last eta was 30min. Trend = slower.
    ctx.state.lastSeen.paceExplainerShownAt = Date.now() - 601_000;
    ctx.state.lastSeen.paceExplainerLastEtaMs = 30 * 60 * 1000;
    const out = stripAnsi(SEGMENTS['pace-explainer'](ctx));
    assert.match(out, /Pace easing — 5h cap now in \d+h\d\dm \(was 30m, resets in \d+h\d\dm\)/);
});

test('pace-explainer: "steady" copy when eta changes within the trend threshold', () => {
    const ctx = makeCtx({ pct: 50, resetsInSec: 4 * 60 * 60 });
    // eta ≈ 1h; last eta also ~1h (within ±60s). Trend = steady.
    ctx.state.lastSeen.paceExplainerShownAt = Date.now() - 601_000;
    ctx.state.lastSeen.paceExplainerLastEtaMs = 60 * 60 * 1000;
    const out = stripAnsi(SEGMENTS['pace-explainer'](ctx));
    assert.match(out, /Holding pace — 5h cap still in \d+h\d\dm \(resets in \d+h\d\dm\)/);
});

test('pace-explainer: clears state when urgency ends so next activation gets "first" copy', () => {
    const ctx = makeCtx({ pct: 5, resetsInSec: 4 * 60 * 60 });
    ctx.state.lastSeen.paceExplainerShownAt = Date.now();
    ctx.state.lastSeen.paceExplainerLastEtaMs = 60 * 60 * 1000;
    const out = SEGMENTS['pace-explainer'](ctx);
    assert.equal(out, null);
    assert.equal(ctx.state.lastSeen.paceExplainerShownAt, undefined);
    assert.equal(ctx.state.lastSeen.paceExplainerLastEtaMs, undefined);
});

test('pace-explainer: pacePreview forces render regardless of urgency and uses synthetic prior eta', () => {
    const ctx = makeCtx({ pct: 5, resetsInSec: 4 * 60 * 60, preview: true });
    // not urgent, but preview forces the line. With no prev eta stored, the
    // synthesizer injects +30m so the copy reads as "slower" (eta grew).
    const out = SEGMENTS['pace-explainer'](ctx);
    assert.ok(out, 'preview mode should force render');
    const clean = stripAnsi(out);
    assert.match(clean, /^⚠ /);
});
