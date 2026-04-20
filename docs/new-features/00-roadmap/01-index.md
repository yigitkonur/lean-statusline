# lean-statusline — next-wave feature roadmap

Plan built from the scored evaluation of 100 ideas + four internet research agents (evidence under `docs/research/`). Every entry below traces back to (a) a specific stdin field or documented platform behavior, (b) prior-art in ccstatusline / claude-powerline / cship / claude-hud / claude-pace / claudeline / ccusage, and (c) a scored rationale.

Read these top-to-bottom. The order is dependency-correct: infrastructure first, then data-surfacing segments, then adaptive layout. Shipping out of order means re-writing earlier features.

## Tier table

| # | Feature | Tier | ∑ | Spec | Depends on |
|---|---|---|--:|---|---|
| 1 | Defensive payload probing | S | 9.50 | [defensive-payload-probing](../defensive-payload-probing/01-spec.md) | — |
| 2 | Per-session state file | S | 9.55 | [session-state-file](../session-state-file/01-spec.md) | — |
| 3 | Transcript bookmark reducer | S | 9.60 | [transcript-bookmark-reducer](../transcript-bookmark-reducer/01-spec.md) | #2 |
| 4 | Conditionals schema | S | 9.40 | [conditionals-schema](../conditionals-schema/01-spec.md) | #2 |
| 5 | Agent only when non-default | S | 9.70 | [agent-non-default](../agent-non-default/01-spec.md) | #4 |
| 6 | `workspace.project_dir` drift crumb | S | 9.25 | [project-dir-drift](../project-dir-drift/01-spec.md) | #4 |
| 7 | Worktree always-on | S | 9.25 | [worktree-always-on](../worktree-always-on/01-spec.md) | #4 |
| 8 | Suppress cost when 0 | S | 9.10 | [suppress-cost-zero](../suppress-cost-zero/01-spec.md) | #4 |
| 9 | Project-pinned overrides (first-match-wins) | S | 9.00 | [project-overrides](../project-overrides/01-spec.md) | — |
| 10 | Stateless pace math | S | 9.25 | [stateless-pace-math](../stateless-pace-math/01-spec.md) | — |
| 11 | Pace delta segment | S | 9.30 | [pace-delta](../pace-delta/01-spec.md) | #10 |
| 12 | Native subagent count | A | 8.80 | [native-subagent-count](../native-subagent-count/01-spec.md) | #1 |
| 13 | Width-adaptive layout with drop order | A | 8.55 | [width-adaptive-layout](../width-adaptive-layout/01-spec.md) | #1 |
| 14 | Reset-countdown ≤5 min collapse | A | 8.50 | [reset-countdown-collapse](../reset-countdown-collapse/01-spec.md) | #11 |
| 15 | Two-band thresholds | A | 8.15 | [two-band-thresholds](../two-band-thresholds/01-spec.md) | — |

## Ship order (dependency-correct)

```
Wave 0 — infrastructure (must ship before any segment work)
  └─ 1. defensive-payload-probing    (30 LOC; unlocks 2, 12, 13)
  └─ 2. session-state-file           (100 LOC; unlocks 3, 4, 11, 14)
  └─ 9. project-overrides            (80 LOC; orthogonal)

Wave 1 — architectural layer (rewrites the segment registry)
  └─ 4. conditionals-schema          (200 LOC; retires ~15 hand-coded guards)

Wave 2 — silent-when-meaningful segments (apply the schema)
  ├─ 5. agent-non-default
  ├─ 6. project-dir-drift
  ├─ 7. worktree-always-on
  └─ 8. suppress-cost-zero

Wave 3 — rate-limit intelligence
  ├─ 10. stateless-pace-math         (pure function, 15 LOC)
  ├─ 11. pace-delta                  (segment, 40 LOC)
  ├─ 14. reset-countdown-collapse    (width-aware)
  └─ 15. two-band-thresholds         (colorForPct upgrade)

Wave 4 — transcript-aware signals (gated behind 'full' preset)
  ├─ 3. transcript-bookmark-reducer  (200 LOC reducer)
  └─ 12. native-subagent-count       (2-line segment)

Wave 5 — adaptive layout
  └─ 13. width-adaptive-layout        (4-tier drop ladder)
```

## Positioning matrix (which preset gets what)

| Feature | minimal | compact | full |
|---|:-:|:-:|:-:|
| 1 defensive-payload-probing | ✅ always | ✅ always | ✅ always |
| 2 session-state-file | ✅ always | ✅ always | ✅ always |
| 3 transcript-bookmark-reducer | — | — | ✅ full only |
| 4 conditionals-schema | ✅ always | ✅ always | ✅ always |
| 5 agent-non-default | ✅ | ✅ | ✅ |
| 6 project-dir-drift | ✅ | ✅ | ✅ |
| 7 worktree-always-on | ✅ | ✅ | ✅ |
| 8 suppress-cost-zero | n/a | n/a | ✅ |
| 9 project-overrides | ✅ | ✅ | ✅ |
| 10 stateless-pace-math | ✅ | ✅ | ✅ |
| 11 pace-delta | — | ✅ (inline) | ✅ (full bar) |
| 12 native-subagent-count | — | ✅ when >0 | ✅ when >0 |
| 13 width-adaptive-layout | ✅ | ✅ | ✅ |
| 14 reset-countdown-collapse | n/a | ✅ | ✅ |
| 15 two-band-thresholds | ✅ | ✅ | ✅ |

## Non-goals (explicit)

These were in the original 100 but research eliminated them:

- **Wall-clock decay timers** (`session_name` 10s auto-hide, version toast 30s, bypass-banner fade). Claude Code's `refreshInterval` skips paint during idle (#48445 open). Replace with event-count `max_messages` where reasonable.
- **Fade-on-rename** (#12). `/rename` fires no statusline event (#40287 open).
- **OSC 8 repo link** (#75). Root cause is Ink's `eraseLines()`, not tmux (#37216). Broken in most environments from the statusline specifically.
- **Nerd Font PUA chevrons** (any powerline styling). Stripped by Claude Code's renderer (#49270).
- **Live-ticking wall clock, animated spinners, auto-generated session title**. All depend on reliable idle-period paints.
- **Direct OAuth API polling for rate limits.** Stdin already ships `rate_limits.*`. Adding a second data source for the same signal creates the discrepancy problem documented in ccusage#916.

## Key principles derived from research

1. **Stdin covers 80%** — only parse transcripts for genuine differentiators (active subagents, last tool, failure streaks). Don't re-derive what the payload already carries.
2. **Stateless math is regression-proof** — the v2.1.100 silent-token incident broke every statusline that cached `used_pct`. Pace delta uses only fields from the current payload.
3. **Event-count ≫ wall-clock** — every "show for N" rule should be `max_messages: N`, not `decay_seconds: N`.
4. **First-match-wins, not deep-merge** — matches cship and claude-powerline; avoids the partial-override footgun that bit claude-powerline users on Windows.
5. **Surface Anthropic's numbers raw** — never compute or correct percentages. Users distrust displays that disagree with `/usage`.
6. **Defensive field probing** — four new payload fields shipped in April 2026 (`effortLevel`, `skills`, `subagents`, terminal `columns/rows`) that the public docs don't mention. Treat every field as optional.

## Evidence base

- `docs/research/transcript-statuslines/` — Agent 1: viability verdict + byte-offset reducer design
- `docs/research/rate-limit-pace/` — Agent 2: claude-pace formula, ccusage patterns, reset-countdown UX
- `docs/research/statusline-conditionals/` — Agent 3: 6-field schema from 4 shipping projects
- `docs/research/claude-code-statusline-platform/` — Agent 4: open-issue matrix, undocumented fields
