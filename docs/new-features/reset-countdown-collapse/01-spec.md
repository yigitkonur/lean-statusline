# Reset-countdown ≤5-minute collapse

**Tier:** A | **Composite:** 8.50 | **Original ID:** #43 (promoted from B per Agent 2) | **Depends on:** pace-delta, stateless-pace-math

## 1. What it is

When the 5-hour (or 7-day) rate-limit window is ≤5 minutes from resetting, collapse the entire `rate-*-full` line's composite (`label + bar + pct + pace + countdown`) into a single pulsing `↻ 3m` cue in green. Information-dense when information matters most; invisible otherwise because the full line is already shown. Also applies unit-adaptive countdown formatting (`NNs` / `NNm` / `Nh` / `Nd`) across all reset displays.

## 2. Showcase

```
                Reset countdown collapse
┌───────────────────────────────────────────────────────────────┐
│ Normal render (>5 min to reset)                                │
│   current ●●●●●●●●○○  82% ⇡+14 (in 1h42m)                      │
│                                                                │
│ T-minus 5 min: collapses to bright pulse                       │
│   current ↻ 4m                                                 │
│   ───────────────                                              │
│   (all other info hidden — your quota is about to refresh,     │
│    that's the only thing that matters right now)               │
│                                                                │
│ Unit-adaptive countdown examples:                              │
│   (in 45s)    — seconds when <60s                              │
│   (in 23m)    — minutes when <60m                              │
│   (in 4h12m)  — hours when <24h                                │
│   (in 2d3h)   — days when ≥24h                                 │
└───────────────────────────────────────────────────────────────┘
```

## 3. Why we need it

- **Users regularly refresh the statusline obsessively at T-minus 10 min** to confirm they can resume at reset.
- **Agent 2 found no shipping tool does this.** r/Anthropic thread with 171 upvotes explicitly requested a "about-to-refresh" signal.
- **Collapsing reduces noise at the exact moment** where the rest of the segment's data is stale (pace delta meaningless at 99% of window, bar already full).
- **Unit-adaptive formatting** is a cheap companion fix — `(in 4320s)` is useless; `(in 1h12m)` reads instantly.

## 4. Ecosystem examples

- **SippieCup gist (Mar 2026)** — shows countdown but doesn't collapse.
- **jtbr gist (Feb 2026)** — similar.
- **claude-pace** — renders separate pace banner but no reset collapse.
- **ccusage, ccstatusline, claude-powerline, cship** — none collapse.
- **Unique to lean-statusline.** Evidence: `docs/research/rate-limit-pace/isaacaudet/02-unit-adaptive-countdown.md`.

## 5. Position on the line

Replaces the entire `rate-5h-full` (or `rate-7d-full`) segment's content when collapse triggers. Other line-2 segments unaffected.

## 6. How users use it

Default-on at 5-min threshold. Tune:

```json
{
  "rateLimit": {
    "collapseMinutes": 5,
    "collapseColor": "green",
    "countdownUnits": "auto"
  }
}
```

## 7. Default mode

**Always on** in any preset that renders `rate-*-full`. `minimal` preset uses inline `5h`/`7d` segments, not full; they get unit-adaptive countdown only, not collapse.

## 8. Visualization

- Unicode: `↻ 4m` in bright green (matches a "good news" band).
- ASCII: `~ 4m`.
- Single-segment line replaces the normal composite.
- Width: ~6 chars — trivially fits any terminal.

Unit-adaptive countdown format (used everywhere a countdown is rendered):

| Remaining | Render |
|---|---|
| `< 60s` | `NNs` (e.g. `45s`) |
| `< 60m` | `NNm` (e.g. `23m`) |
| `< 24h` | `NhNNm` (e.g. `4h12m`) |
| `≥ 24h` | `NdNh` (e.g. `2d3h`) |

## 9. Data source

- `input.rate_limits.<window>.resets_at`
- `Date.now()`
- `stateless-pace-math` for remaining calculation.

## 10. Doability

**Trivial.** Threshold check + formatter swap. Pure functions, no I/O.

## 11. Performance budget

- +0.05 ms per rate-full segment when near collapse.
- Zero when far from reset.

## 12. Reliability & failure modes

- **`resets_at` invalid** (string/malformed): `parseResetsAt` returns null → segment renders without collapse (fallback to normal).
- **Clock skew makes remaining negative**: clamp to 0, render `↻ now`.
- **Threshold straddles render boundary**: could flash in/out between renders. Mitigation: 30s hysteresis — don't un-collapse until remaining > 360s.

## 13. Config schema

```json
{
  "rateLimit": {
    "collapseMinutes": 5,
    "hysteresisSeconds": 30,
    "collapseColor": "green",
    "countdownUnits": "auto",
    "collapseGlyph": "↻"
  }
}
```

## 14. Code integration

**Edit `lib/segments.mjs fmtCountdown()`** (line 199) — adopt unit-adaptive format:

```js
function fmtCountdown(epochMs) {
  if (!epochMs) return null;
  const remaining = Math.max(0, Math.floor((epochMs - Date.now()) / 1000));
  if (remaining === 0) return 'now';
  if (remaining < 60)      return `${remaining}s`;
  if (remaining < 3600)    return `${Math.floor(remaining / 60)}m`;
  if (remaining < 86400) {
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return `${h}h${m.toString().padStart(2, '0')}m`;
  }
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  return `${d}d${h}h`;
}
```

**Edit `renderRateFull()`** (line 219) to collapse below threshold:

```js
function renderRateFull(label, lim, ctx, barWidth, windowKey) {
  if (!lim || lim.pct == null) return null;

  const collapseSec = (ctx.cfg.rateLimit?.collapseMinutes ?? 5) * 60;
  const remainingSec = lim.resetsAt ? Math.max(0, (lim.resetsAt - Date.now()) / 1000) : Infinity;

  // Hysteresis: if currently collapsed, stay collapsed until extra buffer.
  const wasCollapsed = ctx.state?.lastSeen?.[`${windowKey}.collapsed`] === true;
  const hyst = ctx.cfg.rateLimit?.hysteresisSeconds ?? 30;
  const shouldCollapse = remainingSec <= collapseSec + (wasCollapsed ? hyst : 0);

  if (shouldCollapse && lim.resetsAt) {
    const cd = fmtCountdown(lim.resetsAt);
    const glyph = ctx.icons.ctx === '%' ? '~' : (ctx.cfg.rateLimit?.collapseGlyph ?? '↻');
    ctx.state.lastSeen[`${windowKey}.collapsed`] = true;
    return `${ctx.palette.white(label)} ${ctx.palette.green(`${glyph} ${cd}`)}`;
  }
  ctx.state.lastSeen[`${windowKey}.collapsed`] = false;

  // ... existing full render ...
}
```

**Edit `lib/presets.mjs`** — conditional defaults per preset (compact + full both use `rateLimit.collapseMinutes: 5`).

## 15. Dependencies

- `stateless-pace-math` — shares the `parseResetsAt` helper.
- `session-state-file` — for the `wasCollapsed` hysteresis flag.
- `pace-delta` — provides the context for why raw pct is hidden during collapse.

## 16. Testing

- **Unit** (`test/segments.test.mjs`):
  - `remaining = 7 min` → normal render.
  - `remaining = 3 min` → collapsed `↻ 3m`.
  - `remaining = 0s` → `↻ now`.
  - Unit boundaries: 59s/60s/3599s/3600s/86399s/86400s each render correctly.
  - Hysteresis: collapse at 4:55, stay collapsed at 5:10 (within 30s buffer).
- **Snapshot** across windows and edge times.

## 17. Rollout plan

- Ship in `@1.5.0` with pace-delta.
- Release notes include an animated example showing collapse transition.

## 18. Regression risks

- **Users don't notice the collapse is happening** (thought pct/bar disappeared): color-coded green + unique glyph makes intent clear. Documentation shows the transition.
- **Hysteresis fails under disk-full** (state file won't write): collapse flickers once per threshold crossing. Acceptable.

## 19. Success metrics

- Zero user complaints about "quota info vanished near reset."
- User screenshots showing the collapse during active sessions.
- Anecdote: users stop running `/usage` at T-minus 5.

## 20. Open questions

- Should collapse also apply to inline `5h`/`7d` segments? Different visual character — probably just color the % bright green instead. Defer.
- Multi-window collapse (both 5h AND 7d in collapse range at once): render each separately. Extremely rare.
- Accessibility: pulsing / bright color might bother some users. Config has `collapseColor: null` option to disable coloring entirely.
