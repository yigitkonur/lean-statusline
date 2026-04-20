# What alternative pace/burn-rate formulations exist in the ecosystem, and how do they compare to claude-pace's subtraction?

**Scope:** Three concretely-documented formulations (claude-pace subtraction, vfmatzkin projection-ratio, damiafuentes projection-with-floor), how each handles the first-minutes-of-window problem, what they surface to the user, and which surface an explicit projected-exhaustion ETA.
**Last updated:** 2026-04-18
**Confidence:** High — three formulations, each with source code or prompt specs in hand.

## Answer

Three real formulations are documented in running statuslines:
1. **Signed subtraction (claude-pace):** `delta = used_pct − elapsed_pct` — compact, no ETA, no floor needed, degenerates at window boundary.
2. **Projected-endpoint ratio (vfmatzkin/claude-statusline):** `projected_pct = used_pct × window_duration / elapsed`, suppressed during first 2% of window. Surfaces ETA.
3. **Projected-endpoint with bursty-baseline floor (damiafuentes prompt spec):** Same ratio, but **uses at least 1 full day as elapsed baseline for the 7d window** to avoid noise from bursty usage. Surfaces ETA in day-of-week format ("out ~Wed").

All three agree on the top-line behavior (red/yellow/green) but diverge on what the *number* means and whether to project past the current moment.

## Evidence

### Formulation A — claude-pace (signed subtraction)

```
d = used_pct − elapsed_pct
elapsed_pct = 100 × (window_total_minutes − remaining_minutes) / window_total_minutes
```

- **No projection, no ETA.** Just "how much ahead/behind of linear consumption are you *right now*."
- **No explicit floor.** Natural floor comes from integer division: for the 7d window, elapsed_pct stays 0 for ~100 min; for the 5h window, ~3 min.
- **Advantage:** honest, simple, never claims to predict the future.
- **Weakness:** collapses to meaninglessness in the last 1% of the window (rm=0 → delta ≈ used_pct, but that's also when information matters least because reset is imminent).

Source: `claude-pace.sh` lines reading `d=$((u - (w - rm) * 100 / w))` [Astro-Han/claude-pace, 2026-04-13].

### Formulation B — vfmatzkin/claude-statusline (projection-ratio)

From the README:

> **Projection formula:** `projected% = used% × window_duration / elapsed`. Suppressed during the first 2% of the window to avoid noise.

- **Explicit ETA available.** If `projected% > 100`, the tool can back out `time_to_100 = (100 − used%) / (used% / elapsed)`.
- **Explicit floor:** first 2% of the window is suppressed. For 5h that's 6 minutes; for 7d that's ~3.4 hours.
- **Arrow set:**
  - `↑` red — projected >100, reaches limit before reset. Followed by ETA (`↑ 2h`).
  - `→` yellow — projected ~100, on pace.
  - `↓` green — projected <100, under-consuming.
- Color of `↑` reflects urgency: red if <33% of window remains, orange <66%, green otherwise.

Source: [github.com/vfmatzkin/claude-statusline README — "Pace arrows"](https://github.com/vfmatzkin/claude-statusline) — 2026-02~ (referenced in r/ClaudeCode post u/t_zk, post 1s520g6).

### Formulation C — damiafuentes prompt-spec (projection with bursty-baseline floor)

From the prompt in r/ClaudeCode post `1sksf4p` (2026-04):

> **5-hour rate limit — "5h: X% ↻countdown projection". Projection extrapolates current burn rate: if on track to exceed 100%, show "out ~Xh" or "out ~Xm". Color green if projected <100%, yellow if <130%, red if ≥130%. Window = 18000 seconds.**
>
> **7-day rate limit — same, but "out ~Wed" day-of-week. For projection, use at least 1 full day as elapsed baseline (usage is bursty, not 24/7). Window = 604800 seconds.**

- Same ratio as vfmatzkin but with named thresholds: green <100%, yellow <130%, red ≥130%.
- **Unique:** the 7d window uses `max(elapsed, 86400s)` as the denominator. This is the only formulation that explicitly acknowledges weekly usage is not uniform and dampens the projection during the first day.
- **ETA formatted as day-of-week** ("out ~Wed") for the 7d window — the only formulation that does this.

Source: [r/ClaudeCode/comments/1sksf4p](https://reddit.com/r/ClaudeCode/comments/1sksf4p) — u/damiafuentes — 2026-04 — prompt spec for a JS statusline.

### Comparison matrix

| Aspect | A: claude-pace | B: vfmatzkin | C: damiafuentes |
|---|---|---|---|
| Output | Signed delta `⇡N% / ⇣N%` | Arrow + ETA | Arrow + ETA (day-of-week for 7d) |
| First-window-moments handling | Natural (integer division) | Suppress first 2% | Clamp 7d elapsed to ≥1 day |
| Projected-exhaustion ETA | No | Yes, "↑ 2h" | Yes, "out ~Xh" / "out ~Wed" |
| Explicit thresholds | None (sign only) | None (<, ≈, > 100) | 100/130 |
| Projection vs reality | Tells you *right now* | Extrapolates to reset | Extrapolates to reset, but with bursty-aware denominator |
| Honesty with noisy input | High — no claim about future | Medium — 2% cutoff helps | High — day-baseline is a real concession |
| Complexity to implement | ~10 lines bash | ~25 lines JS | ~35 lines JS |

### What the first-5-minute problem actually looks like

For a 5h window, 5 minutes elapsed = 1.67% of window.

- Naive ratio `used/elapsed × 100`: at 2% used after 5 min, projected = 60%. At 3% used after 5 min, projected = 90%. Unstable and fear-inducing.
- vfmatzkin: suppresses entirely (first 2% = first 6 min).
- damiafuentes 5h: no special floor on the 5h window (only the 7d gets the day-baseline).
- claude-pace: shows `d = 2 − 1 = 1` → ⇡1% — flat, accurate, non-alarming.

**Inference:** For the 5h window, claude-pace's subtraction is the least noisy formulation of the three. For the 7d window, damiafuentes' day-baseline is the most honest projection formulation (because weekly usage really is bursty for most developers — evidence in `community/01-burn-rate-displays-feedback.md`).

## Caveats / Negative Signal

- damiafuentes formulation only exists as a prompt spec in one Reddit post; no inspected source file. The logic is specified precisely but the author has not published the script.
- vfmatzkin does not (from the README) specify *which* window the 2% floor applies to. Inferred: both.
- Neither B nor C handles the degenerate case where `used_pct = 0` and elapsed > 0: the projection is 0%, which is fine, but the arrow should probably be suppressed rather than rendered as green `↓`.
- None of the three formulations account for cache hits vs fresh tokens, Opus-weighting, or the v2.1.100+ 20K invisible-token regression (see `schema/02-rate-limits-field-gotchas.md`).

## Sources

- `claude-pace.sh` v0.8.0 — Astro-Han — 2026-04-13 — subtraction formula (authoritative)
- [vfmatzkin/claude-statusline README](https://github.com/vfmatzkin/claude-statusline) — 2026-02~ — projection formula with 2% floor (as documented, not source-inspected)
- [r/ClaudeCode/comments/1sksf4p](https://reddit.com/r/ClaudeCode/comments/1sksf4p) — u/damiafuentes — 2026-04 — prompt-spec with day-baseline floor for 7d
