# Claude Code statusline platform: current state of 8 tracked issues + gap/gotcha matrix (April 2026)

**Scope:** Authoritative status of 8 caller-specified GitHub issues, additional statusline-adjacent issues discovered, current payload schema, refresh semantics, and idea-level doability adjustments.
**Last updated:** 2026-04-18
**Confidence:** High — direct `gh api` reads on all 8 primary issues + 14 adjacent, cross-checked with Anthropic changelog and official docs.

## Document index

| File | What it answers |
|---|---|
| [issues/01-48445-refreshinterval-repaint.md](issues/01-48445-refreshinterval-repaint.md) | Does `refreshInterval` repaint? — **Partially broken.** Timer reruns script, display doesn't update during idle. |
| [issues/02-47071-external-binary-stdout.md](issues/02-47071-external-binary-stdout.md) | Do external binaries work in `statusLine.command`? — **Broken on Windows**, works on mac/Linux. `bash -c` workaround has process-churn side effect. |
| [issues/03-49022-context-breakdown.md](issues/03-49022-context-breakdown.md) | Is `context_breakdown` in the payload? — **Partial.** `#43898` closed-completed, docs don't reflect it, `#49022` re-requests. |
| [issues/04-49270-nerd-font-unicode.md](issues/04-49270-nerd-font-unicode.md) | Do Nerd Font glyphs render? — **No.** PUA codepoints stripped. BMP Unicode works. |
| [issues/05-44982-permission-mode.md](issues/05-44982-permission-mode.md) | Is permission mode in the payload? — **No.** Open request, 0 staff response. Transcript-parse workaround exists. |
| [issues/06-40279-multiline-resize.md](issues/06-40279-multiline-resize.md) | Is multi-line safe? — **2-line OK, 3-line unsafe.** Lines 2+ vanish on resize. |
| [issues/07-40287-rename-refresh.md](issues/07-40287-rename-refresh.md) | Does `/rename` fire a refresh event? — **No.** Cosmetic staleness up to one turn. |
| [issues/08-37216-osc8-tmux.md](issues/08-37216-osc8-tmux.md) | Do OSC 8 hyperlinks work from statusline? — **No** in most environments. Root cause is Ink's eraseLines() clobbering statusline output. |
| [adjacent/01-additional-statusline-issues.md](adjacent/01-additional-statusline-issues.md) | 15+ other statusline-adjacent issues, shipped and open. |
| [adjacent/02-payload-schema-april-2026.md](adjacent/02-payload-schema-april-2026.md) | Full payload field inventory with presence rules. |
| [verdicts/01-refresh-semantics.md](verdicts/01-refresh-semantics.md) | What triggers re-invocation vs repaint. |
| [verdicts/02-gap-vs-gotcha-matrix.md](verdicts/02-gap-vs-gotcha-matrix.md) | Idea-level doability adjustments — #11, #12, #29, #43, #70, #75, #78, #80 mapped. |
| [verdicts/03-roadmap-signals.md](verdicts/03-roadmap-signals.md) | Implicit roadmap signal from the April 2026 shipping burst. |
| [community/01-reddit-sentiment.md](community/01-reddit-sentiment.md) | Reddit practitioner sentiment. |

## Critical findings

1. **All 8 tracked issues are OPEN as of 2026-04-18.** None has a milestone. None has a staff MEMBER/OWNER reply. `#40279` and `#40287` have a `stale` label but have been updated within the last 4 days.
2. **`refreshInterval` is a gotcha, not a gap** (`#48445`). The command runs on the timer but the TUI doesn't repaint. Any idea depending on "the displayed value changes without user action" is at risk. See [issues/01](issues/01-48445-refreshinterval-repaint.md).
3. **April 2026 was a major payload expansion.** `effortLevel`, `skills`, `subagents`, `terminal.columns/rows`, `workspace.git_worktree`, some context breakdown, and startup-render all shipped. Docs schema has NOT caught up — several fields are in payload but not documented yet. See [adjacent/02](adjacent/02-payload-schema-april-2026.md) and [verdicts/03](verdicts/03-roadmap-signals.md).
4. **Permission mode stays a gap** (`#44982`). Event fires but value is not in payload. Transcript-parsing workaround works but is combined with `#48445` during idle — Shift+Tab cycles don't repaint on the timer.
5. **Cross-session state drifts** (`#41377`, `#49935`, `#49927`, `#42646`). `used_percentage` can flicker between sessions and disagrees with the website. Anything showing exact context % or cross-session aggregates has a fundamental accuracy ceiling.
6. **OSC 8 from statusline is broken-by-design** (`#37216`). Ink's `eraseLines()` strips hyperlinks written outside its React tree. The 2.1.113 OSC 8 wrap fix is for response/bash output only — does NOT cover statusline.
7. **`#46778` closed-not_planned** — "background task counts in statusline" explicitly declined. Shapes what agent-count ideas can show: active subagents yes (shipped), background tasks no.

## Explicit verdicts (the 4 caller asked for)

| Behavior | Verdict |
|---|---|
| **(a) `refreshInterval` repainting** | **Broken in idle path.** Script reruns, TUI skips paint. `#48445` open. Time-decay / clock / countdown ideas are affected. |
| **(b) `/rename` firing an event** | **No.** Not in documented trigger list, not in event pipeline. Custom statusline stays stale until next qualifying event. `#40287` open. |
| **(c) Multi-line on resize** | **2 lines: safe IF critical-first; 3 lines: unsafe as default.** Lines 2+ vanish on resize with no recovery until next event. `#40279` open. |
| **(d) OSC 8 in tmux/SSH** | **Broken from statusline everywhere Ink re-paints aggressively.** Not tmux-specific; root cause is in Claude Code's render layer. `#37216` open. Ship plain-text URLs; don't rely on OSC 8 from statusline. |

## Payload roadmap (inferred, no Anthropic confirmation)

Shipping velocity April 1–15 says payload growth is active. Most likely next ships:
1. Auto-generated session title (`#49913`, small, obvious).
2. Permission mode (`#44982`, high demand but 0 staff reply).
3. autoCompactThreshold (`#46428`, small).
4. Context-breakdown v2 (`#49022`, re-request).

Explicitly declined: background task counts (`#46778`), cross-session aggregation (`#48040`).

Umbrella to watch: `#50286` statusLine JSON data-provider extensibility — if shipped, flips the payload model from "Anthropic adds fields" to "authors inject custom keys".

## Action items for the 100-ideas list

Promote (features that shipped):
- Effort-level segment (`#47780` shipped) — A-tier.
- Active skills / running subagents indicator (`#47857` shipped) — A-tier.
- Terminal-responsive width-adaptive layouts (`#41512` shipped) — A-tier.
- Git worktree badge (`workspace.git_worktree` documented) — A-tier.

Demote or restructure:
- **#11 time-decay segment** — demote 1 tier (refreshInterval gotcha).
- **#12 fade-on-rename** — D-tier (compound gap: `/rename` no event + refreshInterval broken).
- **#29 permission-mode color** — demote 1 tier; transcript-parse workaround required.
- **#43 3-line layout** — D-tier as default; opt-in only with doc warning.
- **#70 clickable URL** — demote to D-tier default; opt-in with environment caveat.
- **#75 Nerd Font chevrons** — default must be BMP Unicode; Nerd Font opt-in only.
- **#78 context breakdown stacked bar** — C-tier until breakdown field lands; 2-color variant OK.
- **#80 parallel-agent count** — split: active subagents A-tier, background tasks D-tier.

Add to D-tier (ideas that look doable but aren't):
- Clock / stopwatch / countdown visible during idle.
- Animated spinner driven by `refreshInterval`.
- "Last typed N seconds ago" with visual fade.
- Account balance (`#46329` gap).
- Cross-session aggregated cost (`#48040` declined).
- SGR 5 blink (`#43348` dropped by Ink).
- Auto-compact exact-distance threshold (`#46428` gap).
- Auto-generated session title (`#49913` gap).
- Bright-color brand palette without dim override (`#42382` gotcha).

## Coverage scope

Covered:
- All 8 caller-specified issues, with current state, severity, and caller-relevant workarounds.
- 14 additional statusline-adjacent issues and an inventory of ~60 more in `area:statusline`.
- Current payload schema and presence rules.
- Refresh-event documented triggers + observed failure modes.
- Anthropic changelog 2.1.0–2.1.114 for statusline-related entries.
- Reddit sentiment on workarounds.

Not covered (explicit gaps):
- Exact field names for shipped `effortLevel` / `skills` / `subagents` / `terminal.columns` additions — docs haven't updated. Scripts built against these should expect payload probing.
- Tokenization / Ink internals beyond what issue authors document.
- Non-English docs / community channels (Discord, Slack).
- Private beta channel or staff-only roadmap hints, if any.

## Source roll-up

- GitHub issues reviewed: 27 (8 primary + 19 adjacent), retrieved via `gh api` — all content verified.
- Anthropic docs page: 1 (authoritative statusline docs) — scraped and verified.
- Anthropic changelog: 1 file, 2.1.0–2.1.114.
- Community gists: 1 (AKCodez reference statusline).
- Reddit threads: 1 primary + adjacent search hits.
- Comparison article: 1 (yigitkonur.com, author's own).
