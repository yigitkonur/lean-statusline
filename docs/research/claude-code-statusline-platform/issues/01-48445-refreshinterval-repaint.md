# Does `refreshInterval` actually repaint the statusline on ticks?

**Scope:** Current status of `anthropics/claude-code#48445` and its impact on time-decay / idle-refresh statusline ideas.
**Last updated:** 2026-04-18
**Confidence:** High — direct issue read, reproducer in the issue, docs corroborate the trigger model, 2 comments on the issue, not marked stale.

## Answer

**Partially broken.** The command IS re-invoked on the `refreshInterval` timer, but the terminal region is NOT always repainted. The repaint gap is most visible for payload deltas that originate outside user interaction (e.g. Shift+Tab permission-mode changes, external process state, clock ticks) — the statusline stays frozen until the next UI event forces a flush. Issue is **open** as of 2026-04-18, filed 2026-04-15, labeled `bug / has repro / platform:linux / area:tui / area:statusline`, reported on 2.1.109. No milestone, no fix commit, no Anthropic staff response yet.

## Evidence

- Issue: [anthropics/claude-code#48445](https://github.com/anthropics/claude-code/issues/48445), state: open, opened 2026-04-15, updated 2026-04-15, 2 comments, has-repro labeled, reported on Claude Code 2.1.109.
- Title: "`statusLine.refreshInterval` re-runs the command but does not repaint the display".
- OP (TalatCikikci) quote: "The statusline command is re-executed (confirmed via debug logging) but the terminal display is not updated until the next UI event." Verified by debug-logging the script output.
- Repro: set `"refreshInterval": 3`, press Shift+Tab to cycle permission mode, statusline label stays on old value for 3+ seconds, next message flushes correctly.
- A bot flagged 3 possible duplicates (#32917 between sessions, #14125 post-message render, #20872 shell escape) — OP refuted all three as different symptoms. Still open, not closed as duplicate.
- Docs contradict the bug: the official statusline docs at `code.claude.com/docs/en/statusline` describe `refreshInterval` as "re-runs your command every N seconds **in addition to** the event-driven updates" and explicitly list permission-mode changes as an event trigger. So the contract says this should repaint; empirically on 2.1.109 it does not.
- Documented event triggers (per docs, April 2026): "after each new assistant message, when the permission mode changes, or when vim mode toggles. Updates are debounced at 300ms."

### Documented vs inferred

- **Documented:** (a) command reruns on the timer; (b) repaint happens on UI events; (c) docs say refreshInterval adds timer-driven repaint on top; (d) empirical tests in the issue show the repaint step is missing on the timer path.
- **Inferred:** the bug is likely in the TUI layer — the subprocess output is discarded or written to a back-buffer that isn't flushed until the next Ink render pass. Matches the pattern in #37216 (Ink `eraseLines()` stomps on output written outside its component tree).

## Caveats / Negative Signal

- The bug is recent (3 days old at time of writing) and could be fixed in any 2.1.110+ release. No milestone attached, no assignee.
- Reproduction is platform-Linux-labeled but the event-driven-only behavior is cross-platform — this is a general repaint-pipeline bug, not Linux-specific.
- One possible workaround: pair `refreshInterval` with a no-op periodic UI event (e.g. nudge vim mode or trigger an OSC cursor query) — not documented and not recommended.

## Impact on statusline ideas

Any idea that depends on *the payload changing between ticks without a user-action event* is affected:
- Time-based segments (clock, elapsed-timer, time-since-last-message) — will appear frozen during idle.
- External-process polling (git status changed by a background agent, file-watcher counts, CI status) — frozen during idle.
- Shift+Tab-driven permission-mode indicators — the docs say this is an event trigger, but `refreshInterval` ticks in between don't repaint. Mode indicator gets correct value when Shift+Tab fires the event, *not* between ticks.
- Any "fade" / "decay" / "pulse" visual where the displayed value changes independently of a message/tool-call event is at risk.

## Sources

- `anthropics/claude-code#48445` — TalatCikikci — 2026-04-15 — primary report with repro steps, 2 comments.
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — Anthropic — retrieved 2026-04-18 — authoritative trigger list and refreshInterval contract.
- Anthropic changelog for 2.1.0–2.1.114 — reviewed 2026-04-18 — no entry mentions a refreshInterval repaint fix.
