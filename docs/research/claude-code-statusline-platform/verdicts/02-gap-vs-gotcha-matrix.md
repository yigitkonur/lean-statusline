# Gap-vs-Gotcha matrix for ~15 statusline ideas affected by platform gaps

**Scope:** Maps caller's 100-idea list (specific IDs provided: #11, #12, #29, #43, #70, #75, #78, #80) to each platform-level gap so doability scores can be adjusted directly.
**Last updated:** 2026-04-18
**Confidence:** High for the platform gaps (issue-level evidence); inference for the idea→gap mapping based on the caller's brief.

## Terminology

- **Gap** = feature or payload field the platform doesn't provide today. The idea is *not doable* from payload alone; requires workaround or platform fix.
- **Gotcha** = feature that's nominally available but has a known bug or edge case that degrades it. Idea is doable, but ship with a warning or fallback.

## Core platform issues — status tally

| Issue | Status | Severity |
|---|---|---|
| `#48445` refreshInterval repaint | Open 2026-04-15, 2.1.109 | **Gotcha** — timer runs but paint skipped. |
| `#47071` external binary stdout | Open 2026-04-12, 2.1.92, Windows | **Gotcha** — bash-wrap workaround exists with side effect. |
| `#49022` context_breakdown granularity | Open 2026-04-16 | **Gap** — payload doesn't have full breakdown. Partial via `#43898` closed but shape unclear. |
| `#49270` Nerd Font Unicode | Open 2026-04-16 (reopen of `#9907`) | **Gotcha** — PUA codepoints stripped; BMP Unicode works. |
| `#44982` permission mode | Open 2026-04-08, 0 comments | **Gap** — not in payload; transcript-parse workaround. |
| `#40279` multiline resize | Open 2026-03-28, updated 2026-04-14 | **Gotcha** — safe for 2 lines if critical-first; 3-line unsafe. |
| `#40287` `/rename` refresh | Open 2026-03-28, updated 2026-04-14 | **Gotcha** — cosmetic staleness up to one turn. |
| `#37216` OSC 8 tmux | Open 2026-03-21, updated 2026-04-08 | **Gotcha** — clickable links unreliable from statusline. |

## Idea-level mapping (8 caller-specified IDs)

I don't have the full 100-idea text, so mappings are inferred from the caller's brief. The caller's direct mapping of ideas to gotchas follows.

### #11 — "time-decay" / idle-aware segment

- **Depends on:** `refreshInterval` repainting between events; payload changing between events.
- **Gotchas:** `#48445` (refreshInterval doesn't repaint on idle). `#43826` (statusline sometimes disappears).
- **Verdict:** **Degrade score.** The "decay" animation will feel jerky — invisible during idle, correct on message. Either redesign as "last-event timestamp" (which is event-driven and works), or document the idle quirk.
- **Suggested doability adjustment:** −2 (was likely B-tier, belongs in C-tier until `#48445` closes).

### #12 — fade-on-rename

- **Depends on:** `/rename` firing a statusline event OR `refreshInterval` detecting the `session_name` change.
- **Gaps/gotchas:** `#40287` (rename doesn't fire event) AND `#48445` (refreshInterval doesn't reliably repaint). Compound failure.
- **Verdict:** **Not doable reliably.** Demote to D-tier. Fade animation requires a tick-by-tick redraw that isn't happening.
- **Suggested doability adjustment:** **D-tier.**

### #29 — (assumed) permission-mode-aware color or plan-mode banner

- **Depends on:** reading permission mode from payload.
- **Gap:** `#44982` (not in payload).
- **Workaround:** parse transcript JSONL at `transcript_path` for last `"permissionMode"` line. Works; minor perf hit.
- **Verdict:** **Demote one step.** B → C. Ship with transcript-parsing fallback, document it's not a payload-native field.
- **Suggested doability adjustment:** −1.

### #43 — (assumed) multi-line / 3-line rich layout

- **Depends on:** multi-line rendering surviving resize.
- **Gotcha:** `#40279` (lines 2+ vanish on resize).
- **Verdict:** **Cap at 2 lines.** 3-line layouts should be opt-in only with a doc warning. Put critical info on line 1.
- **Suggested doability adjustment:** If 3-line: D-tier. If 2-line: B-tier unchanged.

### #70 — (assumed) clickable PR / URL hyperlink in statusline

- **Depends on:** OSC 8 surviving Ink's render cycle.
- **Gotcha:** `#37216` (stripped by Ink `eraseLines()`).
- **Verdict:** **Demote.** Ship text URL only; accept non-clickable. If target users are known iTerm2-no-tmux, conditionally wrap with OSC 8 but document the failure modes.
- **Suggested doability adjustment:** −2 (demote from B/C to D for default; keep B as opt-in).

### #75 — (assumed) Nerd Font / powerline chevrons

- **Depends on:** PUA codepoints rendering.
- **Gotcha:** `#49270` (PUA stripped).
- **Verdict:** **Default must be plain Unicode.** Powerline chevrons (U+E0B0) blank. Use box-drawing (`│`) or geometric shapes (`▶`) instead. Nerd Font support → opt-in env var.
- **Suggested doability adjustment:** If idea *requires* Nerd Font: D-tier. If idea *defaults* to Nerd Font with plain fallback: C-tier. If idea *defaults* to plain, Nerd Font opt-in: B-tier.

### #78 — (assumed) context-breakdown stacked bar (system/tools/memory/messages)

- **Depends on:** per-source token counts in payload.
- **Gap:** `#49022` open. `#43898` closed-completed but payload docs don't reflect the breakdown.
- **Workaround:** parse transcript JSONL — slow on long sessions.
- **Verdict:** **Gap idea.** Ship a 2-color variant (used/free) until breakdown lands. Or ship transcript-parsing with a `refreshInterval≥5` throttle.
- **Suggested doability adjustment:** Demote from A/B → C until payload ships breakdown.

### #80 — (assumed) background-subagent / parallel-agent count

- **Depends on:** subagent payload.
- **Partial ship:** `#47857` closed-completed 2026-04-14 — "Expose active skills and running subagents in statusline JSON data". Field name not yet in docs schema.
- **Declined:** `#46778` closed not_planned — "Expose active agent & background task counts in statusline JSON" — Anthropic explicitly declined background task counts.
- **Verdict:** Split. Active skills / running subagents → **doable** once you know the field name (likely shipping in a docs update). Background task counts → **not planned, not doable.**
- **Suggested doability adjustment:** If counting only "running subagents" — A-tier. If counting background tasks — D-tier.

## Candidates for D-tier additions (ideas that look doable but aren't)

Beyond the 8 specified, any idea that depends on these behaviors should be D-tier:

1. **Clock / stopwatch / countdown** that must tick visibly during idle → `#48445`.
2. **Animated spinner driven by `refreshInterval`** → `#48445`.
3. **"Last typed N seconds ago" with visual fade** → `#48445` + event-driven-only refresh.
4. **Account balance** → `#46329` gap (no balance in payload).
5. **Background task count** → `#46778` declined.
6. **Cross-session aggregated cost** → `#48040` declined; `#41377` / `#49935` flicker.
7. **3-line or taller layouts as default** → `#40279`.
8. **Nerd Font-only visual design (Powerline chevrons required)** → `#49270`.
9. **Clickable URL as primary CTA (not fallback text)** → `#37216`.
10. **Auto-generated session title** (sessions that weren't `/rename`d) → `#49913` open, no `session_name`.
11. **Permission mode color as payload-native field** → `#44982` (workaround exists via transcript).
12. **Auto-compact distance exact threshold** → `#46428` gap.
13. **SGR 5 (blink) attribute** → `#43348` dropped by Ink.
14. **ANSI full-color brand palette** (bright colors may be forced to dim) → `#42382`.

## Ideas that SHIPPED, likely upgradable

If your list scored these as "future/waiting", bump them up:

- **Effort-level display** (`#47780` shipped) — A-tier now.
- **Skills / active subagent indicator** (`#47857` shipped) — A-tier once field names are known.
- **Terminal-width responsive layouts** (`#41512` shipped) — A-tier; you can shed optional segments based on `columns`.
- **Git worktree badge** (`workspace.git_worktree` added) — A-tier; documented in schema.
- **Fullscreen mode compatibility** — no longer blocked (`#42418`, `#42710` fixed).
- **Startup render** (`#42637` shipped) — you can show something meaningful before the first message.

## Sources

All sources referenced in sibling files under `docs/research/claude-code-statusline-platform/issues/*.md` and `adjacent/*.md`.
