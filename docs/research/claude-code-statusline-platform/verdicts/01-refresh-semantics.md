# Verdict: statusline refresh semantics in Claude Code (April 2026)

**Scope:** What triggers a statusline re-invocation, what repaints, what doesn't — the actual behavior, not the advertised contract.
**Last updated:** 2026-04-18
**Confidence:** High — docs + issue evidence agree on event model; open bugs document where the repaint path breaks.

## Documented event triggers

Per [official docs](https://code.claude.com/docs/en/statusline) (retrieved 2026-04-18):

> Your script runs **after each new assistant message, when the permission mode changes, or when vim mode toggles**. Updates are debounced at 300ms, meaning rapid changes batch together and your script runs once things settle. If a new update triggers while your script is still running, the in-flight execution is cancelled.

Additional trigger from changelog: statusline now renders on startup before first assistant message (`#42637`, shipped ~2026-04-02).

## Events that do NOT trigger re-invocation

| Event | Triggers script? | Status |
|---|---|---|
| `/rename` | **No** | `#40287` open. The built-in prompt bar updates; custom statusline stays stale until next message. |
| `/color` | **No** | Same pattern as `/rename`; no dedicated fix. |
| `/config` reloads | **No** | Settings reload, but statusline changes only appear on next interaction (per docs). |
| `/model` | **Yes (since 2.1.86)** | Was broken; OP cites `v2.1.86` as the fix. |
| `/clear` | **Yes** but dropped session_name until `#44927` fix (2026-04-15). |
| Terminal resize (`SIGWINCH`) | **No** | `#40279` open. Multi-line layouts collapse to line 1 on resize; no re-invocation. |
| Background subagent state change | **No** | No event. `#46778` declined not_planned — background task counts not exposed. |
| Shift+Tab permission cycle | **Yes in theory** (docs say permission mode change fires event), but `#48445` shows repaint broken on 2.1.109. |
| Skills / subagent start-end | Partial — `#47857` shipped skill+subagent payload fields, but unclear if start/stop fires a dedicated event or piggybacks on message completion. |
| Tool call completion | Partial / debounced with next assistant message event. |

## `refreshInterval` — when to use it, when not to trust it

- **Contract (docs):** "re-runs your command every N seconds in addition to the event-driven updates. The minimum is `1`. Set this when your status line shows time-based data such as a clock, or when background subagents change git state while the main session is idle."
- **Reality (`#48445`, 2026-04-15, open):** command DOES re-run on the timer, but the terminal region is NOT always repainted. The paint flush happens on the next UI event. So `refreshInterval=1` gives you fresh stdout but stale display during idle.
- **Implication:** Any idea that needs "the displayed value changes without user interaction" (clocks, countdown timers, time-since-last-message, external state polled in background) is currently at risk. The command sees the new data; the user sees the old frame.

## Practical refresh rule for designs

- Keep critical info event-driven: derive from payload fields that CHANGE on user action (message send / tool use / mode toggle). These always repaint reliably.
- Treat `refreshInterval` as a belt-and-suspenders hint that works sometimes. Design the statusline so the idle-frozen display is still a correct snapshot of the last event — not a broken or stale-looking frame.
- Avoid blinking/fading/animation that depends on sub-second repaint. Even `refreshInterval=1` is unreliable per `#48445`.
- Accept that `/rename` and terminal-resize will leave the statusline "wrong" until the next message. Design text so rename-staleness looks cosmetic, not buggy.
- For any cross-session aggregation (e.g. "total cost across all active sessions") you can't avoid stale reads; `#49935`/`#49927` document flicker between inconsistent percentages.

## Debounce + cancellation

- 300ms debounce means rapid-fire events collapse to one execution.
- If a new event arrives while your script is still running, **the in-flight execution is cancelled.** Implication: slow statusline scripts can go silent under rapid event streams — keep total execution ≤100ms to avoid cancellation loops.
- `#43826` (open): in some cases the statusline disappears entirely after a response and doesn't re-render. Cancellation-loop behavior may be a factor.

## Sources

- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — retrieved 2026-04-18 — authoritative trigger list.
- `anthropics/claude-code#48445` — open — refreshInterval repaint bug.
- `anthropics/claude-code#40287` — open — `/rename` no refresh.
- `anthropics/claude-code#40279` — open — resize collapses multi-line.
- `anthropics/claude-code#46778` — closed not_planned — background task counts declined.
- `anthropics/claude-code#47857` — closed — skills/subagents exposed.
- `anthropics/claude-code#42637` — closed — startup render.
- `anthropics/claude-code#44927` — closed — `/clear` session_name fix.
- `anthropics/claude-code#43826` — open — statusline disappears after response.
- Anthropic `CHANGELOG.md` 2.1.86 — `/model` refresh fix (OP citation in `#40287`).
