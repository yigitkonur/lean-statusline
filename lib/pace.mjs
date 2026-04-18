import { parseResetsAt as parseUsageResetsAt } from './usage.mjs';

const UNKNOWN = Object.freeze({ delta: null, band: 'unknown', elapsedPct: null });
const DEFAULT_BANDS = Object.freeze({ fastBand: 5, slowBand: -5, suppressBelow: 2 });

export const WINDOW_MS = Object.freeze({
    five_hour: 5 * 60 * 60 * 1000,
    seven_day: 7 * 24 * 60 * 60 * 1000,
});

export const parseResetsAt = parseUsageResetsAt;

function unknownResult() {
    return { ...UNKNOWN };
}

function classify(delta, usedPct, options = {}) {
    const bands = { ...DEFAULT_BANDS, ...options };
    if (usedPct < bands.suppressBelow) return 'neutral';
    if (delta >= bands.fastBand) return 'fast';
    if (delta <= bands.slowBand) return 'slow';
    return 'neutral';
}

export function paceDelta(usedPct, resetsAt, windowKey, now = Date.now(), options = {}) {
    if (usedPct == null) return unknownResult();

    const pct = Number(usedPct);
    const resetsAtMs = parseResetsAt(resetsAt);
    const durationMs = WINDOW_MS[windowKey];
    if (!Number.isFinite(pct) || !Number.isFinite(resetsAtMs) || !durationMs) {
        return unknownResult();
    }

    const windowStart = resetsAtMs - durationMs;
    const elapsedMs = Math.max(0, Math.min(durationMs, now - windowStart));
    const elapsedPct = (elapsedMs / durationMs) * 100;
    const delta = pct - elapsedPct;

    return {
        delta,
        band: classify(delta, pct, options),
        elapsedPct,
    };
}
