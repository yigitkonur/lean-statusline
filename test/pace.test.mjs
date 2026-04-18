import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paceDelta, parseResetsAt, WINDOW_MS } from '../lib/pace.mjs';

const NOW = Date.UTC(2026, 3, 18, 12, 0, 0);

test('pace: parseResetsAt normalizes unix seconds, ms, and ISO strings', () => {
    const epochMs = Date.UTC(2026, 3, 18, 15, 0, 0);
    assert.equal(parseResetsAt(Math.floor(epochMs / 1000)), epochMs);
    assert.equal(parseResetsAt(epochMs), epochMs);
    assert.equal(parseResetsAt(new Date(epochMs).toISOString()), epochMs);
});

test('pace: window durations expose five-hour and seven-day constants', () => {
    assert.equal(WINDOW_MS.five_hour, 5 * 60 * 60 * 1000);
    assert.equal(WINDOW_MS.seven_day, 7 * 24 * 60 * 60 * 1000);
});

test('pace: returns slow when usage trails elapsed pace', () => {
    const resetsAt = NOW + 4 * 60 * 60 * 1000; // 1h elapsed in a 5h window => 20%
    const result = paceDelta(8, resetsAt, 'five_hour', NOW);
    assert.equal(result.band, 'slow');
    assert.equal(Math.round(result.elapsedPct), 20);
    assert.equal(Math.round(result.delta), -12);
});

test('pace: returns fast when usage is ahead of elapsed pace', () => {
    const resetsAt = NOW + 3 * 60 * 60 * 1000; // 2h elapsed in a 5h window => 40%
    const result = paceDelta(60, resetsAt, 'five_hour', NOW);
    assert.equal(result.band, 'fast');
    assert.equal(Math.round(result.elapsedPct), 40);
    assert.equal(Math.round(result.delta), 20);
});

test('pace: zero usage early in the window stays neutral below the suppress floor', () => {
    const resetsAt = NOW + (5 * 60 * 60 * 1000) - Math.round(WINDOW_MS.five_hour * 0.02);
    const result = paceDelta(0, resetsAt, 'five_hour', NOW);
    assert.equal(result.band, 'neutral');
    assert.ok(result.delta < 0);
});

test('pace: missing inputs return unknown without crashing', () => {
    assert.deepEqual(paceDelta(null, NOW, 'five_hour', NOW), {
        delta: null,
        band: 'unknown',
        elapsedPct: null,
    });
    assert.deepEqual(paceDelta(12, null, 'five_hour', NOW), {
        delta: null,
        band: 'unknown',
        elapsedPct: null,
    });
    assert.deepEqual(paceDelta(12, NOW, 'not-a-window', NOW), {
        delta: null,
        band: 'unknown',
        elapsedPct: null,
    });
});

test('pace: past reset times clamp elapsed percent at 100', () => {
    const result = paceDelta(12, NOW - 60_000, 'five_hour', NOW);
    assert.equal(result.band, 'slow');
    assert.equal(result.elapsedPct, 100);
    assert.equal(Math.round(result.delta), -88);
});
