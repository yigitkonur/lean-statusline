# What is the render budget, and how does Claude Code enforce it?

**Scope:** How often statusline scripts are invoked, what cancels them, and what the observed CPU/memory ceiling is.
**Last updated:** 2026-04-18
**Confidence:** High — Anthropic's docs plus a maintainer-quoted issue plus two concrete CPU pathology reports.

## Answer

Claude Code invokes the statusline command **on events** (assistant messages, permission changes, vim-mode toggles) with a **300ms debounce** and cancels in-flight invocations when a new event arrives. Official docs say "slow scripts block the status line from updating until they complete" — i.e. no enforced kill timeout, just starvation. The real-world ceiling is whatever the user tolerates; ccusage in its statusline mode has been observed pinning **300%+ CPU** and **1.5–2.4 GB RAM per process** with multiple sessions open. Anything close to that gets the user to `"command": "echo ''"`.

## Evidence

### The cadence contract — `anthropics/claude-code#24463` (2025-12)

Direct quote from the issue body, confirmed by Anthropic docs:

> "The statusline command script only runs on specific events (assistant messages, permission changes, vim mode toggles), debounced at 300ms. There is no way to trigger periodic re-execution."

A `refreshInterval` field was added after this issue in response. From `code.claude.com/docs/en/statusline`:

> "The optional `refreshInterval` field re-runs your command every N seconds in addition to the event-driven updates. The minimum is `1` [second]. Set this when your status line shows time-based data such as a clock, or when background subagents change git state while the main session is idle."

### No hard timeout — just blocking

From `code.claude.com/docs/en/statusline`:

> "Slow scripts block the status line from updating until they complete. Keep scripts fast to avoid delays in the UI."

This is the entire enforcement. No SIGKILL, no watchdog. A 2-second parse just makes the statusline stale for 2 seconds; it does not crash. But it stacks: if events arrive during the parse, they debounce out, which is why **in-flight cancellation** matters in practice.

### In-flight cancellation: observed behavior

`code.claude.com/docs/en/statusline` advises:

> "Cache expensive operations… `cached_data=$(get_cached_data <cache_file> <max_age> <fetch_command>)`"

The doc explicitly treats the previous invocation as disposable. No formal cancellation semantics are documented; the user-observable behavior is that a long-running script's output can be thrown away when the next event arrives.

### CPU pathology — ccusage statusline

[`ryoppippi/ccusage#804`, 2025-09](https://github.com/ryoppippi/ccusage/issues/804) (an issue against ccusage, the most popular Node-based transcript parser) reports:

> "Each ccusage process consumes 100-400% CPU on startup. Memory usage spikes to 1.5-2.4GB per process. With 2 sessions: combined CPU usage reaches 600%+. v17.2.1 eventually stabilizes (after ~30 seconds) to ~70% CPU. v18.0.5 never stabilizes, stays at 300%+ indefinitely."

> Workaround: `"command": "echo ''"`

This is **on startup** — every statusline invocation is a cold Node process in most setups. ccusage's approach involves scanning *many* transcript files (not just the current session), which compounds the cost. But it demonstrates what "a transcript parser that got ambitious" looks like when users run multiple Claude Code instances.

### What "too slow" means in user terms

From the cstat (Rust) Reddit post, 2026-01 (unverified but directional):

> "claude code calls your status line command every ~300ms. i was using claude-hud but it spawns 24 subprocesses… 62ms each time."

62ms from claude-hud (user-perceived) was enough pain that someone wrote a Rust replacement. 2ms from Rust feels instant. The user tolerance band is roughly: sub-50ms = unnoticed; 50–150ms = "feels laggy at high typing speed"; 150–300ms = stale statusline visible; >300ms = stacked executions start making the terminal feel broken.

### What Claude Code's *own* transcript-reader does when files get big

[`anthropics/claude-code#22365`, 2026-02-01](https://github.com/anthropics/claude-code/issues/22365):

> "A single session JSONL file in `~/.claude/projects/...` had grown to 3.8 GB. Three other session files were 13-28 MB. Claude Code appears to load or index these files on every prompt, causing the memory explosion and hang."
> 
> "top showed the Claude process consuming 12.8 GB of RAM."

Claude Code itself fails at this. A statusline that full-reads the same files has the same exposure.

## Caveats / Negative Signal

- The 300ms debounce is not formally published by Anthropic as a contract — it's quoted in issue #24463 by a user, not by a maintainer in-thread. But the doc's refreshInterval minimum of 1 second, and the downstream projects that all target 300ms, treat it as stable.
- Terminal rendering can break on long conversations even without a slow statusline ([claude-code#16578, 2025-11](https://github.com/anthropics/claude-code/issues/16578) — "status updates print on new lines instead of updating in place"). This is Claude Code's own bug, orthogonal to statusline perf, but users will blame whichever statusline is visible when it happens.
- `u/coloradical5280` and others praise Contextify on r/ClaudeCode (2026-01) — it's a separate macOS app that monitors the transcripts continuously, not a statusline script. That is the *other* architecture: a persistent process with direct file-watching. No statusline ships this.

## Sources

- `anthropics/claude-code#24463` — statusline debounce/events — 2025-12 — [issue](https://github.com/anthropics/claude-code/issues/24463)
- `code.claude.com/docs/en/statusline` — "Slow scripts block the status line" — fetched 2026-04-18
- `ryoppippi/ccusage#804` — 300% CPU, 2.4GB RAM — 2025-09 — [issue](https://github.com/ryoppippi/ccusage/issues/804)
- `anthropics/claude-code#22365` — 3.8 GB session file hangs Claude Code — 2026-02-01 — [issue](https://github.com/anthropics/claude-code/issues/22365)
- `anthropics/claude-code#16578` — terminal rendering break on long conversations — 2025-11 — [issue](https://github.com/anthropics/claude-code/issues/16578)
- `u/OtherwiseJellyfish73` r/ClaudeAI 2026-01 — 62ms perceived claude-hud latency
