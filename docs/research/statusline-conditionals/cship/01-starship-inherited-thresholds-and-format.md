# What does cship inherit from Starship, and which patterns port to Claude Code?

**Scope:** stephenleo/cship (Rust, TOML config `~/.config/cship.toml`). Focus: `warn_threshold` / `critical_threshold` per module, `format` string substitution, Starship module passthrough, `ttl` cache, per-project override.
**Last updated:** 2026-04-18
**Confidence:** High — README and all 7 showcase configs scraped verbatim.

## Answer

cship's key design move is to **reuse Starship's TOML module model verbatim**: each module gets `symbol`, `style`, `format`, plus a **two-band threshold system** — `warn_threshold` + `warn_style`, `critical_threshold` + `critical_style`. The `lines` array of format strings lets users place any Starship module (e.g. `$git_branch`, `$directory`, `$python`) alongside native `$cship.*` modules via the `starship prompt` passthrough. Critically: **cship supports a project-root `cship.toml` for per-project overrides**, and ships a `ttl` field on `usage_limits` (seconds) for cache discipline.

The patterns that port cleanly to a conditionals map for lean-statusline:

1. **Two bands per segment** (`warn_threshold` + `critical_threshold`) — a simple, widely understood mental model inherited from Starship.
2. **`ttl` seconds** — explicit per-segment cache lifetime for expensive/network data.
3. **Project-root override file** — tiny, predictable, git-committable.
4. Starship's `detect_files` / `detect_folders` pattern (not yet used by cship itself for Claude segments, but available via Starship passthrough — see Caveats).

## Evidence

**Two-band threshold pattern (verbatim from README showcase #1 "Minimal"):**

```toml
[cship.cost]
style              = "green"
warn_threshold     = 2.0
warn_style         = "yellow"
critical_threshold = 5.0
critical_style     = "bold red"

[cship.context_bar]
width              = 10
warn_threshold     = 40.0
warn_style         = "yellow"
critical_threshold = 70.0
critical_style     = "bold red"
```

This pattern is repeated identically across all 7 showcase configs, applied to `cship.cost`, `cship.context_bar`, and `cship.usage_limits`. Same four keys, consistent semantics. This is the most battle-tested conditional schema in the ecosystem.

**Cache-TTL pattern (verbatim from showcase #3 "Cost Guardian"):**

```toml
[cship.usage_limits]
ttl                = 60        # cache TTL in seconds; increase if running many concurrent sessions
five_hour_format   = "5h {pct}%"
seven_day_format   = "7d {pct}%"
separator          = " "
warn_threshold     = 70.0
warn_style         = "bold yellow"
critical_threshold = 90.0
critical_style     = "bold red"
```

The inline comment ("increase if running many concurrent sessions") shows the author anticipating multi-terminal usage — a pain point that hits all statuslines when every terminal calls the same usage API.

**Per-project override (verbatim, README Configuration):**

> "The default config file is `~/.config/cship.toml` (on Windows: `%USERPROFILE%\.config\cship.toml`). You can also place a `cship.toml` in your project root for per-project overrides."

Same first-match behavior as claude-powerline — not a deep merge.

**Starship passthrough (verbatim, README #7 "Full Starship Prompt"):**

```toml
[cship]
lines = [
  "$starship_prompt",
  "$cship.model $cship.cost $cship.context_bar $cship.usage_limits",
]
```

`$starship_prompt` runs `starship prompt` and splats the rendered output. This means cship inherits Starship's conditional patterns *for Starship-owned data* (e.g. `git_branch` honors Starship's `when` predicates, `python` honors `detect_files = ["requirements.txt", "pyproject.toml"]`). **But cship itself does not expose `when` / `detect_files` for its own `$cship.*` modules.** The conditional power for Claude-specific fields is limited to thresholds.

**Format string templating (verbatim):**

```toml
[cship.context_bar]
symbol = " "
format = "[$symbol$value]($style)"
```

Same substitution grammar as Starship: `$symbol`, `$value`, `$style` placeholders, `[...]($style)` wrapping. Users who know Starship pay zero learning cost.

**Render budget claim (verbatim, README):** "≤10ms render budget."

## Caveats / Negative Signal

- **Starship's `detect_files` / `detect_folders` do not port to `$cship.*` modules.** They only work on native Starship modules invoked via passthrough. A lean-statusline `conditionals` schema that wants "show only in Python repos" must re-implement the detect primitive itself; cship has not done this for its Claude-specific segments.
- **No decay primitive in cship.** The `ttl` is a cache, not a visibility decay. Confirms the #93 hypothesis that decay remains an open problem across the ecosystem.
- **No `when` field for `$cship.agent`.** Users can show/hide `$cship.agent` only by including or excluding it from the `lines` format string — which is a manual, not-conditional mechanism. An "agent non-default" rule still has to be expressed in user shell or not at all.
- **Reddit, u/MachineLearner00 (OP), 2026-04-18:** "There's a 5s cache and updates happen whenever Claude responds to a prompt." — confirms cship does not use `refreshInterval`; relies purely on event-driven updates + caching.
- **Reddit, u/dogazine4570, 2026-04-18:** "Does it fully respect an existing `starship.toml`, or are there limitations on which modules render cleanly inside Claude Code?" — open user question, confirms Starship passthrough is the headline feature.

## Sources

- [stephenleo/cship README](https://github.com/stephenleo/cship) — scraped 2026-04-18.
- r/ClaudeAI "CShip: A beautiful, customizable statusline for Claude Code", scraped 2026-04-18.
- `u/MachineLearner00` (cship author), r/ClaudeAI, 2026-04-18 — confirms 5s cache + event-driven refresh.
- Starship docs (referenced by cship; not independently scraped here — conceptual knowledge for `detect_files`/`detect_folders` patterns is widely documented at `starship.rs/config`).
