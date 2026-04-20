# Suppress cost when 0

**Tier:** S | **Composite:** 9.10 | **Original ID:** #53 | **Depends on:** conditionals-schema

## 1. What it is

Hide the `cost` segment entirely when `cost.total_cost_usd` is `0`, `null`, or absent — not just when absent as it is today. A fresh session reports `0`, which currently renders `$0.00` — visual noise that trains users to ignore the segment when it starts mattering.

## 2. Showcase

```
Before (current lib/segments.mjs:360-366)
  🔒 mac-mini · Opus 4.7 · ✎ 2% · repo (main) · $0.00 · +0 -0 · ⏱ 3s
                                                  ↑ noise           ↑ noise

After this feature
  🔒 mac-mini · Opus 4.7 · ✎ 2% · repo (main) · ⏱ 3s
                                                (cost hidden, lines hidden — see #lines follow-up)

Once work produces cost ≥ $0.01:
  🔒 mac-mini · Opus 4.7 · ✎ 14% · repo (main) · $0.12 · +156 -23 · ⏱ 3m 12s
                                                  ↑ visible when meaningful
```

## 3. Why we need it

- **$0.00 is the default, not an anomaly.** Every fresh session spends the first N seconds with cost=0 while Claude Code boots context. That renders `$0.00` at the precise moment the user is paying closest attention.
- **Users train themselves to ignore the segment.** Once they do, the segment has lost its purpose — you want `$1.47` to jump out.
- **Trivially extends the lean ethos.** Exactly the same pattern the `output-style` segment already uses (`if name === "default" return null`) — apply it to cost's zero value.
- **Pairs with #lines (companion fix):** same logic for `+0 -0` on `lines` segment.

## 4. Ecosystem examples

- **ccusage statusline subcommand** — renders $0.00 always. Evidence: Agent 2 notes the segment looks "present but dead" for the first minute of every session.
- **claude-powerline** — ditto.
- **claudeline** — has a coarse `show_cost_when_zero: false` option; we adopt the same default.
- **Nobody** hides lines at zero. Companion opportunity.

## 5. Position on the line

Existing `cost` slot in `full` preset, between `session-name` and `lines`. No layout change.

## 6. How users use it

Default-on via conditionals. Opt-in (show always):

```json
{ "conditionals": { "cost": { "hide_when_equals": {} } } }
```

## 7. Default mode

**Always on** in `full` preset. `minimal` and `compact` don't include `cost` anyway.

## 8. Visualization

No change to render. Conditional controls visibility only.

## 9. Data source

- `input.cost.total_cost_usd` (documented, always present after first API call).

## 10. Doability

**Trivial.** One conditionals block.

## 11. Performance budget

- Saves ~0.1 ms when segment is hidden (no `toFixed`, no color wrap, no separator padding).

## 12. Reliability & failure modes

- **Negative cost** (shouldn't happen but): conditionals doesn't match, segment shows. Fail-safe: user sees something funky and asks.
- **Precision fractions near zero** (`$0.0001`): `hide_when_equals: [0]` matches only exact zero; anything above 0 shows. Documented.

## 13. Config schema

```json
{
  "conditionals": {
    "cost": {
      "hide_when_equals": { "cost.total_cost_usd": [0, null] }
    },
    "lines": {
      "hide_when_equals_all": {
        "cost.total_lines_added": [0, null],
        "cost.total_lines_removed": [0, null]
      }
    }
  }
}
```

Note: `hide_when_equals` is OR-any-match. `hide_when_equals_all` is AND (all must match) — used for the lines segment which has two fields. Add the `_all` variant to conditionals-schema.

## 14. Code integration

**Edit `lib/presets.mjs` full preset** to include the conditionals default.

**Edit `lib/segments.mjs cost(ctx)`** to drop the existing `if (usd == null) return null;` guard (now handled by conditionals).

**Edit `lib/segments.mjs lines(ctx)`** to drop its null check.

**Edit `lib/conditionals.mjs`** to add `hide_when_equals_all` evaluator (AND-all).

## 15. Dependencies

- `conditionals-schema` + the small `hide_when_equals_all` extension.

## 16. Testing

- **Unit**:
  - `cost = 0` → hidden.
  - `cost = null` → hidden.
  - `cost = 0.001` → visible as `$0.00` (rounds, but above 0).
  - `cost = 1.47` → visible.
  - `lines_added = 0, lines_removed = 0` → hidden.
  - `lines_added = 0, lines_removed = 3` → visible (only `-3`).
- **Snapshot**: fresh-session fixture vs mid-session fixture.

## 17. Rollout plan

- Ship in `@1.4.0` with conditionals-schema.
- Release note: "cost segment hides until meaningful (≥$0.01). Opt out via `conditionals.cost.hide_when_equals = {}`."

## 18. Regression risks

- **User watching for the $0.00 state to confirm statusline is alive**: unlikely but real. Doctor prints a "cost would show at $X" line in verbose mode as a workaround.
- **Segment flickering in/out** as cost crosses zero (won't happen — cost is monotonic per session).

## 19. Success metrics

- Cold-start statuslines look cleaner in screenshots.
- User feedback stops mentioning "$0.00 noise."

## 20. Open questions

- Threshold at `$0.01` instead of `$0.00`? Matches precision default. Probably identical in practice.
- Should we show cost on line 2 always but hide line 1 cost? Over-engineered; skip.
