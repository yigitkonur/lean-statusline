import { parseResetsAt as parseUsageResetsAt } from './usage.mjs';

const UNKNOWN = Object.freeze({
    delta: null,
    band: 'unknown',
    elapsedPct: null,
    etaMs: null,
    resetInMs: null,
    exhaustsBeforeReset: false,
});
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

// Time (ms) until `pct` would hit 100 at the current burn rate.
// Semantics:
//   pct >= 100           → 0            (already at cap)
//   elapsedPct < suppress → null        (cold start — can't project)
//   pct <= 0 || no burn  → Infinity     (will never hit)
//   else                 → finite number
function estimateEtaMs(pct, elapsedMs, elapsedPct, suppressBelow) {
    if (pct >= 100) return 0;
    if (elapsedPct < suppressBelow) return null;
    if (pct <= 0 || elapsedMs <= 0) return Infinity;
    const ratePerMs = pct / elapsedMs;
    if (ratePerMs <= 0) return Infinity;
    return (100 - pct) / ratePerMs;
}

export function paceDelta(usedPct, resetsAt, windowKey, now = Date.now(), options = {}) {
    if (usedPct == null) return unknownResult();

    const pct = Number(usedPct);
    const resetsAtMs = parseResetsAt(resetsAt);
    const durationMs = WINDOW_MS[windowKey];
    if (!Number.isFinite(pct) || !Number.isFinite(resetsAtMs) || !durationMs) {
        return unknownResult();
    }

    const bands = { ...DEFAULT_BANDS, ...options };
    const windowStart = resetsAtMs - durationMs;
    const elapsedMs = Math.max(0, Math.min(durationMs, now - windowStart));
    const elapsedPct = (elapsedMs / durationMs) * 100;
    const delta = pct - elapsedPct;
    const resetInMs = Math.max(0, resetsAtMs - now);
    const etaMs = estimateEtaMs(pct, elapsedMs, elapsedPct, bands.suppressBelow);
    const exhaustsBeforeReset = Number.isFinite(etaMs) && etaMs < resetInMs;

    return {
        delta,
        band: classify(delta, pct, options),
        elapsedPct,
        etaMs,
        resetInMs,
        exhaustsBeforeReset,
    };
}
