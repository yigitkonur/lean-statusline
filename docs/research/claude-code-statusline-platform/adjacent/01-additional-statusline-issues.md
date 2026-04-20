# What other statusline-adjacent issues exist on anthropics/claude-code?

**Scope:** Sweep of `area:statusline`-labeled issues beyond the 8 caller-specified ones, prioritized by relevance to statusline design ideas.
**Last updated:** 2026-04-18
**Confidence:** High — pulled via `gh api search/issues?q=repo:anthropics/claude-code+is:issue+label:area:statusline` on 2026-04-18. 120+ issues in label.

## Answer

Well beyond the 8 listed, at least **15 materially relevant statusline-area issues** exist. The most important bucket: **payload additions**. Anthropic shipped `effortLevel`, `workspace.git_worktree`, terminal dimensions, and some context breakdown variant in April 2026; active open requests are concentrated around per-session cost/balance, effort level (resolved), permission mode, context breakdown granularity, and subagent visibility. Second bucket: **rendering bugs** (flicker, overlap with bottom UI, stale content after response, desktop-app status bar). Third bucket: **agent-teams coordination** (teammate indicators, subagent count).

## Recently SHIPPED (closed-completed) — April 2026

| # | Title | Closed | Relevance |
|---|---|---|---|
| [45973](https://github.com/anthropics/claude-code/issues/45973) | [FEATURE] Configurable Status Line | 2026-04-10 | Umbrella config landed — may be related to `/statusline` slash command and the hardcoded indicator. |
| [47857](https://github.com/anthropics/claude-code/issues/47857) | Expose active skills and running subagents in statusline JSON data | 2026-04-14 | **Skills + subagents now in payload.** Docs haven't fully updated the schema. |
| [47780](https://github.com/anthropics/claude-code/issues/47780) | Include effortLevel in statusline stdin JSON | 2026-04-15 | **effortLevel field shipped.** Docs don't show it yet — will likely appear in a future docs update. Also `#43428`, `#45003` closed completed. |
| [41512](https://github.com/anthropics/claude-code/issues/41512) | statusline JSON should include terminal dimensions (columns/rows) | 2026-04-01 | Terminal width/height in payload — enables responsive layouts. Matches `#40279` mitigations. |
| [43898](https://github.com/anthropics/claude-code/issues/43898) | Expose context breakdown by source in status line JSON | 2026-04-06 | Closed completed. Form unclear — docs still only list aggregate. `#49022` re-requests it. |
| [44927](https://github.com/anthropics/claude-code/issues/44927) | `/clear` drops session_name from statusline JSON | 2026-04-15 | Session-name pipeline actively maintained. Not `/rename` refresh. |
| [42637](https://github.com/anthropics/claude-code/issues/42637) | Status line should render immediately on startup | 2026-04-02 | **Startup render shipped** — statusline now renders before first assistant message. |
| [42418](https://github.com/anthropics/claude-code/issues/42418) | CLAUDE_CODE_NO_FLICKER=1 breaks statusLine | 2026-04-02 | Fixed. Fullscreen mode now preserves statusline. |
| [42469](https://github.com/anthropics/claude-code/issues/42469) | New bottom UI overlaps with custom statusLine on Ghostty | 2026-04-02 | Fixed. |
| [42710](https://github.com/anthropics/claude-code/issues/42710) | CLAUDE_CODE_NO_FLICKER disables statusline in IntelliJ | 2026-04-14 | Fixed. |
| [41494](https://github.com/anthropics/claude-code/issues/41494) | Status bar shows default effort, not per-turn ultrathink | 2026-03-31 | Fixed. |

## Most important OPEN statusline issues (beyond the 8 listed)

| # | Title | Why it matters |
|---|---|---|
| [50286](https://github.com/anthropics/claude-code/issues/50286) | statusLine JSON data-provider extensibility — let authors inject custom keys | Umbrella request to end per-field FRs; if shipped, changes the game for many ideas. Filed 2026-04-18. |
| [50324](https://github.com/anthropics/claude-code/issues/50324) | Status bar CTX indicator stuck / not incrementing (regression) | NEW regression 2026-04-18. Affects any idea depending on `used_percentage` liveness. |
| [50175](https://github.com/anthropics/claude-code/issues/50175) | Expose current effort level to statusline JSON and session JSONL | Even after `#47780` closed completed, users still requesting — suggests docs/schema drift. |
| [49939](https://github.com/anthropics/claude-code/issues/49939) | [FEATURE] Multi-position statusLine (top + bottom) | Would allow splitting content — relevant to multi-line alternatives. |
| [49935](https://github.com/anthropics/claude-code/issues/49935) | Usage indicator flickers between inconsistent percentages across sessions | Multi-session reads conflict. Affects anyone with `used_percentage` in an external dashboard. |
| [49927](https://github.com/anthropics/claude-code/issues/49927) | Usage indicator randomly flickers between percentages | Pair report to above. |
| [49913](https://github.com/anthropics/claude-code/issues/49913) | Expose auto-generated session title in statusline JSON | `session_name` only if manually set via `/rename`; auto-titled sessions have no name in payload. |
| [48548](https://github.com/anthropics/claude-code/issues/48548) | Custom status line content overlaps with resume hint on exit | Rendering-layer edge case. |
| [48458](https://github.com/anthropics/claude-code/issues/48458) | SSH remote hostname no longer visible (regression) | Label `regression`; affects anyone showing remote context. |
| [46428](https://github.com/anthropics/claude-code/issues/46428) | Expose autoCompactThreshold in statusLine JSON | Needed to compute "distance to compaction" accurately. |
| [46419](https://github.com/anthropics/claude-code/issues/46419) | Allow customizing or hiding the permission mode indicator text | The hardcoded mode indicator can't be replaced. |
| [46329](https://github.com/anthropics/claude-code/issues/46329) | Expose session cost and account balance in status line JSON | Cost already in payload (`cost.total_cost_usd`); account balance is not. |
| [44794](https://github.com/anthropics/claude-code/issues/44794) | Status line: context percentage text intermittently disappears on re-render | Open rendering bug; occasional blank cells. |
| [43831](https://github.com/anthropics/claude-code/issues/43831) | Add option to suppress "X% until auto-compact" footer label | Another hardcoded-UI removal request. |
| [43826](https://github.com/anthropics/claude-code/issues/43826) | Status line disappears after assistant response and does not re-render | Severe rendering bug; open, last updated 2026-04-14. |
| [43348](https://github.com/anthropics/claude-code/issues/43348) | Statusline Ansi component drops SGR 5 (blink) attribute | Ink/ansi-tokenize silently drops blink. |
| [42646](https://github.com/anthropics/claude-code/issues/42646) | `context_window.used_percentage` includes `cache_read_input_tokens`, inflated after /clear | Affects context% accuracy for any idea using `used_percentage` directly. |
| [42382](https://github.com/anthropics/claude-code/issues/42382) | Status line: pass ANSI colors through instead of forcing dimColor | Open — colors in statusline are currently dimmed. Affects brand/palette ideas. |
| [41377](https://github.com/anthropics/claude-code/issues/41377) | Status line usage % doesn't match website session usage | Payload value is locally computed, can drift. |
| [41366](https://github.com/anthropics/claude-code/issues/41366) | Diff view and status line show stale lines-changed count | `cost.total_lines_added/removed` can be stale. |
| [49861](https://github.com/anthropics/claude-code/issues/49861) | Feature: persistent plan/context reference visible in UI | Plan-mode context display request. |
| [44779](https://github.com/anthropics/claude-code/issues/44779) | No visibility into session token cost — 1M context makes existing warnings useless | Hits all "context cost" ideas. |
| [44417](https://github.com/anthropics/claude-code/issues/44417) | [FEATURE] — empty-title feature request | Unclear, label suggests another payload ask. |
| [44245](https://github.com/anthropics/claude-code/issues/44245) | Allow statusline scripts to set session color/name via JSON control messages | If shipped, enables "set color from script" — powerful but not in payload today. |
| [43271](https://github.com/anthropics/claude-code/issues/43271) | Community Status Line: Rate Limit Projections, Survive Indicators, Cost Tracking | Community-desired features. |
| [44849](https://github.com/anthropics/claude-code/issues/44849) | Add statusLine support to VS Code native extension | VS Code extension has no statusline support yet. |
| [41456](https://github.com/anthropics/claude-code/issues/41456) | Add status bar to Desktop App | Electron desktop app lacks statusline. |

## Also notable (closed)

- `#46778` "Expose active agent & background task counts in statusline JSON" — **closed not_planned** 2026-04-12. Anthropic declined to expose background task counts — affects any idea counting parallel agents.
- `#48040` "Aggregate token usage / cost across sub-agent sessions in status line" — closed duplicate. Aggregate-across-sessions not on roadmap per close.
- `#49251`, `#45285`, `#45429`, `#49316` — "false update available" cluster, all closed completed 2026-04-18. Update-checker noise fixed.
- `#45466` / `#45465` (docs) — docs missing `workspace.git_worktree` and `refreshInterval`. 45465 still open as of 2026-04-08.

## Sources

- `gh api search/issues?q=repo:anthropics/claude-code+is:issue+label:area:statusline` — retrieved 2026-04-18.
- Anthropic public changelog `CHANGELOG.md` — reviewed 2026-04-18.
