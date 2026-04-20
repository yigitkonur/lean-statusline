# What has Anthropic signaled about planned statusline payload additions?

**Scope:** Roadmap / staff-response / milestone signal in `area:statusline` issues.
**Last updated:** 2026-04-18
**Confidence:** Medium — Anthropic does not publish a public statusline roadmap; signal is inferred from the close/not_planned pattern and the April 2026 shipping velocity.

## Answer

**No published roadmap.** No issue reviewed has a milestone attached. No `state: open` issue has a staff (MEMBER / OWNER) response announcing a timeline. Anthropic has shipped a burst of statusline payload additions in the first two weeks of April 2026 — `effortLevel` (`#47780`), skills+subagents (`#47857`), terminal dimensions (`#41512`), git_worktree badge, context-breakdown v1 (`#43898`), startup-render (`#42637`), and session-name fixes (`#44927`). Pattern suggests steady, un-announced payload growth driven by high-volume user feature requests, not a published roadmap.

## Evidence of the shipping burst

From the closed-completed issues in April 2026:

| # | Title | Closed | Signal |
|---|---|---|---|
| 47780 | effortLevel in statusline JSON | 2026-04-15 | Payload +1 |
| 47857 | Active skills + running subagents in JSON | 2026-04-14 | Payload +2 |
| 45003 | Effort level in statusline data | 2026-04-08 | Duplicate of 47780 |
| 43428 | thinking_budget / reasoning_effort | 2026-04-04 | Payload +1 |
| 43898 | Context breakdown by source | 2026-04-06 | Payload +N (shape unclear) |
| 41512 | Terminal dimensions (columns/rows) | 2026-04-01 | Payload +2 |
| 42637 | Render on startup | 2026-04-02 | Behavior |
| 42418 | CLAUDE_CODE_NO_FLICKER fix | 2026-04-02 | Behavior |
| 42469 | Ghostty bottom-UI overlap fix | 2026-04-02 | Behavior |
| 44927 | /clear session_name fix | 2026-04-15 | Behavior |
| 42710 | IntelliJ CLAUDE_CODE_NO_FLICKER | 2026-04-14 | Behavior |
| 45973 | Configurable Status Line | 2026-04-10 | Umbrella |
| 45481 | Docs: context-low warning location | 2026-04-17 | Docs |
| 45466 | Docs: git_worktree field | 2026-04-11 | Docs |

Velocity: ~10 payload or behavior fixes closed in 18 days. Documentation catching up at a lower rate (`#45465` still open — docs missing `refreshInterval`).

## What Anthropic has explicitly declined

- `#46778` "Expose active agent & background task counts in statusline JSON" — **closed not_planned** 2026-04-12. Explicit no-ship on background-task-count exposure.
- `#48040` "Aggregate token usage / cost across sub-agent sessions" — closed duplicate. Cross-session aggregation not taken.
- `#42747` "[BUG] My buddy doesn't say anything <3" — closed not_planned (unrelated, humor).

No other `state:closed state_reason:not_planned` in the retrieved set.

## Umbrella request to watch

`#50286` "statusLine JSON data-provider extensibility — let authors inject custom keys instead of filing per-field FRs" — filed 2026-04-18, open. If Anthropic ships this, the parade of per-field feature requests becomes less important. Ideas that today hit a payload gap could be rendered via user-provided data providers. Worth monitoring.

## Hints from existing infrastructure

- The `/statusline` slash command (natural-language statusline config) implies an internal pipeline that generates `~/.claude/statusline.sh` scripts from descriptions. Growth here may surface more structured config (beyond raw scripts).
- `#44245` "Allow statusline scripts to set session color and name via JSON control messages" — if shipped, flips the data flow so scripts can PUSH to the UI, not just READ.
- `#49939` "Multi-position statusLine (top + bottom)" — non-trivial UI change, but if shipped, changes the layout question entirely.

## Near-term likely payload additions (inference only)

Based on volume, simplicity, and adjacency to already-shipped work:

1. **Auto-generated session title** — `#49913`. Small, obvious, likely lands.
2. **Permission mode** — `#44982`. High user demand, 0 staff comments; not certain.
3. **autoCompactThreshold** — `#46428`. Small, obvious.
4. **Context breakdown granularity (v2)** — `#49022`. Re-request of already-shipped `#43898`; likely gets a revisit.
5. **Account balance** — `#46329`. Semi-sensitive; could go either way.

## Caveats

- Anthropic does not publish a roadmap, does not assign issues to milestones, and rarely comments on issues. Pattern-based inference only.
- "Shipped" in closed-completed does not always mean "shipped to docs". Several shipped features have not yet updated the docs schema — expect drift.
- Version gating unclear: changelog entries are in the patch-level changelog but most payload additions don't get individual changelog callouts. Issue close-completed is more reliable than changelog grep.

## Sources

- All `anthropics/claude-code#NNNNN` references — retrieved 2026-04-18 via `gh api`.
- Anthropic `CHANGELOG.md` — reviewed 2026-04-18.
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — retrieved 2026-04-18.
