# How does Claude Code decide when to invoke the statusline script, and what does `refreshInterval` actually do?

**Scope:** The official Claude Code status-line execution model — event triggers, 300 ms debounce, in-flight cancellation, and the optional `refreshInterval` setting. This file does NOT cover stdin schema (see `event-model/02-stdin-schema-cheatsheet.md`).
**Last updated:** 2026-04-18
**Confidence:** High — primary source is the official docs page, verified against two third-party implementations.

## Answer

Claude Code runs the status-line command **on events, not on a timer by default**. Triggers: (a) after each new assistant message, (b) permission mode change, (c) vim-mode toggle. Updates are **debounced at 300 ms** — rapid changes batch together. If a new update arrives while the previous script run is still executing, the in-flight execution is **cancelled**. The optional top-level `refreshInterval` field (seconds, minimum `1`) re-runs the command on a fixed timer **in addition to** event triggers. It is explicitly documented as the escape hatch for "time-based data such as a clock, or when background subagents change git state while the main session is idle".

## Evidence

**Documented (`code.claude.com/docs/en/statusline`, scraped 2026-04-18):**

> "Your script runs after each new assistant message, when the permission mode changes, or when vim mode toggles. Updates are debounced at 300ms, meaning rapid changes batch together and your script runs once things settle. If a new update triggers while your script is still running, the in-flight execution is cancelled."

> "The optional `refreshInterval` field re-runs your command every N seconds in addition to the [event-driven updates](#how-status-lines-work). The minimum is `1`. Set this when your status line shows time-based data such as a clock, or when background subagents change git state while the main session is idle. Leave it unset to run only on events."

Settings shape (verbatim):

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2
  }
}
```

`padding` and `refreshInterval` are the only documented sibling fields besides `type` and `command`.

**Documented failure modes (same page):**

- "Scripts that exit with non-zero codes or produce no output cause the status line to go blank."
- "Slow scripts block the status line from updating until they complete. Keep scripts fast to avoid stale output."
- "If a new update triggers while a slow script is running, the in-flight script is cancelled."
- Status line is hidden during autocomplete, help menu, and permission prompts.
- If `disableAllHooks: true`, status line is also disabled.
- The command only runs if the workspace-trust dialog has been accepted for the current directory.

**Inferred for decay-style features ("show session_name for 10 s then hide"):**

Without `refreshInterval`, an event-only script **cannot reliably fade out a segment on its own schedule** — the next repaint only happens when the user sends a message. So if the user starts a session named `feature-x`, reads a 30-line assistant reply, and then stops typing, the status line freezes with `session_name` visible forever until the next message. The only three viable decay strategies are:

1. Set `refreshInterval: 1` (or `2`) so the status line repaints on a wall clock. Cost: an extra subprocess every N seconds even when nothing is happening.
2. Derive the "time alive" from a field already in the JSON (e.g. `cost.total_duration_ms` — stable per-message, monotonic within a session). No timer needed, but decay only advances when a new message arrives.
3. Persist a `first_seen_at` timestamp in a state file keyed by `session_id` on first render; hide the segment when `now - first_seen_at > 10 s`. This still requires a tick to actually repaint — so it falls back to option 1.

Option 2 is the only timer-free strategy, and it answers the strategic-intent question: **no existing project can correctly fade a segment on wall-clock time without `refreshInterval`**, because event-only updates can go quiet for minutes while subagents work.

## Caveats / Negative Signal

- `refreshInterval` minimum is 1 second; there is no documented upper bound. It stacks with event triggers, so at `refreshInterval: 1` the script may still run more than once per second if an event lands between ticks.
- The docs do not guarantee that `refreshInterval` fires while UI overlays are active (autocomplete, permission prompts) — during those periods the status line is hidden entirely.
- In-flight cancellation means a slow script (>300 ms) combined with a chatty session can lead to **no statusline render at all** for long stretches. This is ccstatusline's motivation for its widget-level caching and the docs' own `/tmp/statusline-git-cache-$SESSION_ID` pattern.
- Reddit thread u/sirmalloc (OP of ccstatusline), r/ClaudeAI 2026-04-18 scrape, says: "The statusline code only runs once per prompt... If you resize after the line is written, there are two things you can do to get it to resize. 1) send a new prompt... or 2) simply press Esc once." (Confirms event-driven model in practice.)

## Sources

- [Customize your status line](https://code.claude.com/docs/en/statusline) — Anthropic official docs — scraped 2026-04-18 — canonical reference for triggers, debounce, cancellation, `refreshInterval`.
- `u/sirmalloc` (author of ccstatusline), r/ClaudeAI, 2026-04-18 scrape — "The statusline code only runs once per prompt" — confirms event-only default behavior in the wild.
- `u/MachineLearner00` (author of cship), r/ClaudeAI, 2026-04-18 scrape — "There's a 5s cache and updates happen whenever Claude responds to a prompt." — confirms no third-party project polls below event cadence.
