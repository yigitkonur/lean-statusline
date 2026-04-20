# Pace delta segment

**Tier:** S | **Composite:** 9.30 | **Original ID:** #42 (promoted from A) | **Depends on:** stateless-pace-math | **Used by:** reset-countdown-collapse, width-adaptive-layout

## 1. What it is

Render the pace delta next to each rate-limit segment as a small up/down arrow with magnitude: `⇡+14` when burning faster than sustainable, `⇣−8` when slower, hidden when neutral. Appears inline after `5h NN%` and in the `rate-5h-full` / `rate-7d-full` blocks. Uses the stateless-pace-math function. No wall-clock timers, no caches.

## 2. Showcase

```
                Pace delta render
┌──────────────────────────────────────────────────────────────┐
│ minimal preset                                                │
│   🔒 box · Opus · ✎ 12% · repo · 5h 23% ⇡+14 · 7d 41%         │
│                                       ↑ burning               │
│                                                                │
│ compact preset (default)                                      │
│   🔒 box · Opus · ✎ 12% · repo (main)                          │
│   current ●●●○○○○○○○  23% ⇡+14 (in 2h14m)                      │
│   weekly  ●●●●○○○○○○  41% ⇣−3  (in 4d22h)                      │
│                                                                │
│ full preset                                                    │
│   ... same compact ... with optional projected-exhaustion badge│
└──────────────────────────────────────────────────────────────┘
```

Band colors:
- `fast` (burning): orange arrow, red if critical
- `slow` (saving): green arrow (good news)
- `neutral`: hidden entirely — noise when on track

## 3. Why we need it

- **Raw percentages are ambiguous.** "23% used in 5h" is either fine or alarming depending on how far into the window you are.
- **Highest-scoring research promotion.** Pace delta moved from A-tier (8.45) to S-tier (9.30) because:
  - Formula is stateless (Agent 2 / regression-proof).
  - r/Anthropic threads with 170+ upvotes prove users want this exact signal.
  - No shipping tool renders it inline with the rate segments the way the research recommends.
- **Table stakes differentiator.** Every rate-limit statusline shows percentages; no one shows *pace* on the same line.

## 4. Ecosystem examples

- **claude-pace** — separate dedicated segment, renders as full-width line. We fold it inline to respect the lean ethos.
- **ccusage statusline** — different time-weighted formula; Agent 2 flagged it as regression-fragile.
- **kcchien/claude-code-statusline** — gradient bar reflects burn but no explicit pace number.
- **We're shipping the first stateless inline pace display.** Evidence: `docs/research/rate-limit-pace/verdict/01-stateless-math-wins.md`.

## 5. Position on the line

Two forms of render:

1. **Inline** (minimal / compact-inline variants): append to existing `5h` / `7d` segments: `5h 23% ⇡+14`.
2. **Full** (rate-5h-full / rate-7d-full): insert between the bar and the countdown: `current ●●●○○○○○○○  23% ⇡+14 (in 2h14m)`.

Width-adaptive-layout drops the pace delta first at <100 cols.

## 6. How users use it

Default-on in all rate-limit segments. Turn off:

```json
{ "show": { "paceDelta": false } }
```

Tune bands:

```json
{ "pace": { "fastBand": 10, "slowBand": -10 } }
```

## 7. Default mode

**Always on** when `rate_limits.*.used_percentage ≥ 2` (suppressBelow floor from stateless-pace-math) AND band !== 'neutral'. Hidden otherwise.

## 8. Visualization

- Unicode: `⇡+14` orange, `⇣−8` green, neutral hidden.
- ASCII fallback: `^+14` / `v-8`.
- Never shows `±0` — neutral just hides.
- Max width: `⇡+NN` = 4 chars; `⇡+NNN` clamped at 99 max.

## 9. Data source

- `input.rate_limits.five_hour.used_percentage`
- `input.rate_limits.five_hour.resets_at`
- Same for `seven_day`.
- `Date.now()` via `paceDelta()` function.

## 10. Doability

**Trivial** given stateless-pace-math. Adds ~30 LOC to `lib/segments.mjs`.

## 11. Performance budget

- +0.1 ms per render (two `paceDelta` calls).
- Zero allocations in neutral path.

## 12. Reliability & failure modes

- **`resets_at` missing**: pace returns `null`, segment renders without pace arrow. No failure.
- **Wild clock skew** (laptop time off by hours): clamp elapsedPct, band defaults to 'neutral'. Users see no arrow — better than a wrong one.
- **Silent-token regression**: stateless formula renders `delta ≈ 0` during a zeroed-`used_pct` period; user sees "neutral" rather than "saving fast" (which would be a lie).

## 13. Config schema

```json
{
  "show": { "paceDelta": true },
  "pace": {
    "fastBand": 5,
    "slowBand": -5,
    "suppressBelow": 2
  }
}
```

## 14. Code integration

**Edit `lib/segments.mjs`** — add pace render helper:

```js
import { paceDelta } from './pace.mjs';

function renderPaceArrow(lim, windowKey, ctx) {
  if (ctx.cfg.show.paceDelta === false) return '';
  const { delta, band } = paceDelta(lim?.pct, lim?.resetsAt, windowKey);
  if (delta == null || band === 'neutral' || band === 'unknown') return '';
  const sign = delta >= 0 ? '+' : '';
  const arrow = (band === 'fast')
    ? (ctx.icons.ctx === '%' ? '^' : '⇡')
    : (ctx.icons.ctx === '%' ? 'v' : '⇣');
  const color = band === 'fast' ? ctx.palette.orange : ctx.palette.green;
  return ` ${color(`${arrow}${sign}${Math.round(delta)}`)}`;
}
```

**Edit `5h(ctx)` and `7d(ctx)`** to append the pace arrow:

```js
'5h'(ctx) {
  const lim = ctx.rateLimits?.fiveHour;
  if (lim?.pct == null) return null;
  return `${ctx.palette.dim('5h')} ${fmtPct(lim.pct, ctx)}${renderPaceArrow(lim, 'five_hour', ctx)}`;
}
```

Same edit to `7d(ctx)`.

**Edit `renderRateFull()`** to insert pace between pct and countdown:

```js
function renderRateFull(label, lim, ctx, barWidth, windowKey) {
  if (!lim || lim.pct == null) return null;
  // ... existing bar render ...
  let out = `${ctx.palette.white(label)}${bar} ${pctStr}${renderPaceArrow(lim, windowKey, ctx)}`;
  if (lim.resetsAt) {
    const cd = fmtCountdown(lim.resetsAt);
    if (cd) out += ` ${ctx.palette.dim(`(${cd})`)}`;
  }
  return out;
}
```

Pass `'five_hour'` / `'seven_day'` explicitly from `rate-5h-full` / `rate-7d-full` wrappers.

## 15. Dependencies

- `stateless-pace-math` (Wave 3 prereq).
- `defensive-payload-probing` (for `rate_limits.*` access).

## 16. Testing

- **Unit**: verify render output for each band, each window, ASCII + unicode.
- **Snapshot**: full line across 5h=10/elapsed=5, 5h=40/elapsed=10, 5h=2/elapsed=20 fixtures.
- **Regression fixture**: replay v2.1.100 silent-token incident (`used_pct = 0` mid-session) and assert rendered delta is `null`, not a misleading "saving" signal.

## 17. Rollout plan

- Ship in `@1.5.0` behind `show.paceDelta: true` default.
- Release notes demonstrate the inline arrow with a GIF.

## 18. Regression risks

- **Users read the arrow wrong** (expecting "up is good"). Mitigation: use ⇡ (burning is bad) deliberately, color-code, include sign. Explain in release notes.
- **Visual noise in `compact-inline`** if both windows display. Width ladder drops 7d pace first, then 5h pace.

## 19. Success metrics

- Pace delta rendering in 95% of sessions that have `rate_limits` populated (≥2% used).
- Zero false-positive "burning" displays during synthetic silent-token tests.
- Social signal: user screenshots highlighting pace arrows.

## 20. Open questions

- Should the arrow pulse / invert color on first render after crossing a band threshold? Tempting (attention-grabbing). Risky — depends on reliable event-driven rendering. Defer.
- Position of arrow — before or after percentage? Agent 2 recommends after. Matches Starship's convention of "metric then signal."
- Unicode arrows vs superscript (`²³%↑`) vs words (`fast`)? Arrow + number wins on width-efficiency.
