# Stateless pace math

**Tier:** S | **Composite:** 9.25 | **Original ID:** N1 (new from Agent 2) | **Depends on:** — | **Blocks:** pace-delta, reset-countdown-collapse, projected-exhaustion-ETA

## 1. What it is

A pure function `paceDelta(used_pct, window_start_epoch, window_end_epoch, now) → {delta, band}` that computes how far ahead or behind "sustainable burn" the user is, using **only fields from the current payload**. Zero cross-render state. Zero cached percentages. Immune to the v2.1.100 silent-token regression that broke every pace display relying on cached `used_pct`.

## 2. Showcase

```
The claude-pace formula (Agent 2 evidence)

  delta = used_pct − elapsed_pct

  where:
    elapsed_pct = 100 × (now − window_start) / (window_end − window_start)
    used_pct    = from rate_limits.<window>.used_percentage  (NEVER cached)
    window_start = window_end − window_duration              (5h or 7d)

Examples (5h window, 5 minutes into session):
  used_pct = 2%,  elapsed_pct = 1.7%  →  delta = +0.3  →  neutral
  used_pct = 8%,  elapsed_pct = 1.7%  →  delta = +6.3  →  ⇡ burning fast
  used_pct = 2%,  elapsed_pct = 10%   →  delta = −8.0  →  ⇣ slow / saving

Edge cases handled by the formula alone (no floor needed):
  • first 3 minutes of 5h window:  elapsed_pct ≈ 1 → doesn't explode
  • first 100 minutes of 7d window: elapsed_pct > 0.9 → stable
  • at window reset:               elapsed_pct → 0, used_pct → 0 → delta ≈ 0
```

## 3. Why we need it

- **Raw `used_pct` without pace context is nearly useless.** "23% in 5h" doesn't tell you if you're fine or in trouble.
- **Research verdict (Agent 2):** claude-pace's formula IS the complete answer. No moving averages, no buckets, no cached state. Ten lines of math.
- **Silent-token regression defense.** Stateful pace formulas broke when Claude Code v2.1.100 zeroed `used_pct` intermittently. Stateless math renders a believable neutral `delta ≈ 0` during the regression rather than a confident-but-wrong projection.
- **Foundation for 3 features**: pace-delta segment, reset-countdown collapse, projected-exhaustion ETA.

## 4. Ecosystem examples

- **claude-pace** (Astro-Han) — the source of the formula. Evidence: `docs/research/rate-limit-pace/claude-pace/01-formula-and-bash.md`.
- **damiafuentes** — extends with projected-exhaustion using the same formula. Evidence: `docs/research/rate-limit-pace/projected-exhaustion/01-formula-with-daily-floor.md`.
- **ccusage's statusline** — implements a different time-weighted moving average. Agent 2 found it slower to respond and subject to the v2.1.100 regression.
- **vfmatzkin** — adds a `< 2%` floor below which projections are suppressed. Adopt this.

## 5. Position on the line

Not a segment — a utility. Lives in `lib/pace.mjs`.

## 6. How users use it

Users consume the downstream segments (pace-delta, reset-countdown, etc.). This function isn't user-facing.

## 7. Default mode

**Always available**. Pure function; no side effects; zero cost when not called.

## 8. Visualization

None directly. Output is the `{delta, band}` tuple consumed by rendering features.

## 9. Data source

- `input.rate_limits.five_hour.used_percentage` (or seven_day)
- `input.rate_limits.five_hour.resets_at` (epoch seconds, but also ms/ISO; already handled by `parseResetsAt` in `lib/usage.mjs`)
- `Date.now()`
- Window duration constants: 5 hour = 18_000_000 ms; 7 day = 604_800_000 ms

## 10. Doability

**Trivial.** 15-line pure function. No I/O, no state. Already half-implemented in `lib/usage.mjs parseResetsAt`.

## 11. Performance budget

- <0.01 ms. Three divisions and a subtraction.

## 12. Reliability & failure modes

- **`resets_at` absent**: return `{ delta: null, band: 'unknown' }`. Downstream renders "--" per the silent-floor feature.
- **`used_pct` null or string**: probe layer coerces; if still invalid, return same unknown tuple.
- **`resets_at` in the past** (clock skew, stale cache): cap `elapsed_pct` at 100, downstream decides what to do.
- **`resets_at` in the far future** (malformed, >1 week for 5h window): clamp to max window size, warn once.

## 13. Config schema

User-configurable bands (matches cship two-band thresholds):

```json
{
  "pace": {
    "fastBand": 5,       // delta ≥ +5 → "burning fast"
    "slowBand": -5,      // delta ≤ -5 → "saving"
    "suppressBelow": 2   // suppress delta entirely when used_pct < 2%
  }
}
```

## 14. Code integration

**New file:** `lib/pace.mjs` (~60 LOC)

```js
const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;

export const WINDOW_MS = {
  five_hour: FIVE_HOUR_MS,
  seven_day: SEVEN_DAY_MS,
};

export function paceDelta(usedPct, resetsAtMs, windowKey, now = Date.now()) {
  if (usedPct == null || resetsAtMs == null) {
    return { delta: null, band: 'unknown', elapsedPct: null };
  }
  const dur = WINDOW_MS[windowKey];
  if (!dur) return { delta: null, band: 'unknown', elapsedPct: null };

  const windowStart = resetsAtMs - dur;
  const elapsedMs = Math.max(0, Math.min(dur, now - windowStart));
  const elapsedPct = (elapsedMs / dur) * 100;
  const delta = usedPct - elapsedPct;

  return { delta, band: classify(delta, usedPct), elapsedPct };
}

function classify(delta, usedPct, opts = { fast: 5, slow: -5, suppressBelow: 2 }) {
  if (usedPct < opts.suppressBelow) return 'neutral';
  if (delta >= opts.fast) return 'fast';
  if (delta <= opts.slow) return 'slow';
  return 'neutral';
}

// Projected exhaustion — damiafuentes' formula with vfmatzkin's floor.
// Returns { projectedPct, etaMs } or null if < suppressBelow.
export function projectExhaustion(usedPct, resetsAtMs, windowKey, now = Date.now()) {
  if (usedPct == null || usedPct < 2) return null;
  const dur = WINDOW_MS[windowKey];
  const windowStart = resetsAtMs - dur;

  // Floor elapsed at 1 day for 7d window so weekly projections don't
  // blow up for a burst on day-1.
  const minElapsed = windowKey === 'seven_day' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
  const elapsedMs = Math.max(minElapsed, now - windowStart);
  const elapsedPct = Math.max(minElapsed / dur * 100, (elapsedMs / dur) * 100);

  const projectedPct = (usedPct / elapsedPct) * 100;
  // ETA at projected rate: when does used_pct hit 100%?
  const rate = usedPct / elapsedMs;                  // % per ms
  const remainingPct = 100 - usedPct;
  const etaMs = rate > 0 ? remainingPct / rate : Infinity;

  return { projectedPct, etaMs };
}
```

**Edit `lib/usage.mjs`** to export `parseResetsAt` (already exported; just re-import from `pace.mjs`) so both modules agree on epoch/ISO normalization.

## 15. Dependencies

- None strictly; uses only built-in `Date.now()` and the probe map.

## 16. Testing

- **Unit** (`test/pace.test.mjs`):
  - Happy path: `used=8, resets in 4h of 5h window` → elapsed_pct≈20, delta≈−12, band='slow'.
  - Burning fast: `used=60, 2h into 5h window` → elapsed_pct=40, delta=+20, band='fast'.
  - Zero-used early window: `used=0, elapsed=2%` → delta=−2, band='neutral' (below suppressBelow).
  - Missing fields: return `{delta: null, band: 'unknown'}`.
  - Clock skew: `resets_at` in the past → elapsedPct clamped, no crash.
- **Property-based** (if we add fast-check later): for any valid (used, elapsed), `-100 ≤ delta ≤ 100`.

## 17. Rollout plan

- Ship in `@1.5.0` alongside `pace-delta` segment.
- Keep API stable for downstream `reset-countdown-collapse` and future projected-exhaustion segment.

## 18. Regression risks

- **Formula change downstream** (we decide to switch to time-weighted MA): keep `paceDelta` stable, add a second function like `paceDeltaEMA` and let preset choose. Don't break v1 consumers.
- **Silent-token regression re-triggers**: formula is defense-in-depth; users see `delta ≈ 0` (neutral) instead of a wrong confident projection.

## 19. Success metrics

- Unit coverage at 100% on the pure function.
- Zero pace-related crashes in 1000-session corpus.
- Pace-delta segment renders sane values during a simulated silent-token replay fixture.

## 20. Open questions

- Expose configurable `fast`/`slow` thresholds per-window? (Maybe the 7d window warrants stricter bands since it's a bigger window.) Defer to user feedback.
- Should `classify` factor in remaining time? (e.g. "fast" is worse if there's only 10 min left in window.) Defer — adds complexity for marginal gain.
