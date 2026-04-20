# How does ccstatusline model per-widget conditional visibility?

**Scope:** sirmalloc/ccstatusline (npm `ccstatusline`, 7.6k+ stars, TypeScript, TUI-driven config at `~/.claude/ccstatusline/settings.json`). Focus: per-widget "hide when empty", threshold colors, decay, per-project override.
**Last updated:** 2026-04-18
**Confidence:** High for documented behavior (README + USAGE.md scraped). Medium for internal schema details — `src/types/Settings.ts` was not directly readable (GitHub blob page blocks unauthenticated scrape) but behavior is inferable from the TUI keybind reference.

## Answer

ccstatusline **does not have a general-purpose `conditionals` map**. Instead, each widget carries its own set of single-letter TUI toggles, and "hide when empty" is a per-widget opt-in flag (TUI key `h`) on the minority of widgets where absence is meaningful (git-family, PR, skills, env). There is no centralized show/hide DSL, no threshold DSL at the widget level, no `when_field_equals` primitive, no decay timer, and **no documented per-project override mechanism** — `settings.json` lives at `~/.claude/ccstatusline/settings.json` only.

The project's real innovation is its **Custom Command widget**: users get a generic "shell out and show the output" primitive with `timeout`, `max-width`, and `preserve colors` fields. Conditional logic that doesn't fit the built-in widgets is pushed out to user shell scripts, not declared.

## Evidence

**Per-widget hide toggles (from `docs/USAGE.md`, verbatim):**

> "- **Git widgets with empty-state toggles**: `h` hide `no git` / empty output where supported
> - **Git PR**: `h` hide empty/no-PR output, `s` toggle review status, `t` toggle title
> - **Git remote widgets** (`Git Origin*` / `Git Upstream*`): `h` hide when no remote
> - **Git Is Fork**: `h` hide when the repo is not a fork
> - **Skills**: `v` cycle view mode, `h` hide when empty, `l` edit list limit in list mode
> - **Current Working Dir**: `h` home abbreviation"

Note: `h` is overloaded — "hide when empty" for git widgets, "home abbreviation" for cwd, "hours-only" for weekly reset timer. There is **no shared semantic** across widgets.

**Threshold handling:** Absent as a widget config. The only "threshold-like" behavior is hard-coded in some rendering modes (e.g. Context Bar has fixed color ramps) and documented threshold patterns in user-provided Bash in the official docs (green <70 / yellow 70-89 / red 90+). ccstatusline does not let users express "turn red at 90%" in its config — they either accept the built-in palette or write a Custom Command.

**Custom Command widget shape (verbatim, USAGE.md):**

> "Execute shell commands and display their output dynamically:
> - Refreshes whenever the statusline is updated by Claude Code
> - Receives the full Claude Code JSON data via stdin
> - Configurable timeout (default: 1000ms)
> - Optional max-width truncation
> - Optional ANSI color preservation (`preserve colors`)"

TUI keybinds: `e` command, `w` max width, `t` timeout, `p` preserve ANSI colors.

**Global formatting flags (USAGE.md):**

- Default padding, default separator, inherit colors, global bold, minimalist mode, override FG color, override BG color.
- These act at the render layer, not per-widget, so they are not conditionals in the #93 sense.

**Context Bar widget options:**

- `p` toggle full-width vs short progress bar. That is the full visibility vocabulary.

**Session/Weekly/Block timer widgets:**

- `p` cycle time/full bar/short bar, `s` toggle compact time, `v` invert fill, `h` hours-only (weekly reset only). No threshold config.

**Per-project override:** No mention in README or USAGE.md. Settings live in a single user-scoped file. The ccstatusline-usage fork (pcvelz/ccstatusline-usage) does not add per-project overrides either.

**Decay:** No built-in decay. No time-limited segment. The only time-based widget is Session Clock (runs forever) and Block Timer (5-hour rate-limit window from transcript timestamps).

## Caveats / Negative Signal

- **Config is TUI-managed, not human-authored.** Config bitrot risk: users who hand-edit `settings.json` may end up with state the TUI overwrites. This is an ergonomic bias — good if you want discoverability, bad if you want a committable config.
- **The widget system is code-level extension, not data-level.** To add a new conditional ("show X only when Y"), users fork the repo (per the Reddit thread: "if you have an idea for a new widget, feel free to fork the code and submit a PR"). ccstatusline-usage fork explicitly exists because the base didn't ship certain usage widgets.
- **User pain points (r/ClaudeAI, 2026-04-18 scrape):** `u/torijinsir`: "`claude update` completely wiped out all my settings.json and plugins/markets/mcp etc after I installed this CCStatusLine." — update collision with Claude Code settings. `u/Crafty-Wonder-7509`: terminal-resize doesn't trigger a re-render; must press Esc or send a message. Confirms the event-only model cripples responsive resize.
- **Positive signal (r/ClaudeAI):** `u/DeadlyMidnight`: "CCStatusline allows you to fully configure powerline styles with custom themes and dividers. As well as a bunch of inputs and custom commands." — the TUI + Custom Command combo is the project's strength.

## Sources

- [sirmalloc/ccstatusline README](https://github.com/sirmalloc/ccstatusline) — scraped 2026-04-18.
- [sirmalloc/ccstatusline docs/USAGE.md](https://github.com/sirmalloc/ccstatusline/blob/main/docs/USAGE.md) — scraped 2026-04-18.
- `u/sirmalloc`, r/ClaudeAI thread "CCStatusLine v2 out now", 2026-04-18 — "I've modularized the widget system quite a bit to make this easier. If you have an idea for a new widget, feel free to fork the code and submit a PR."
- `u/torijinsir`, r/ClaudeAI, 2026-04-18 — reports settings collision with `claude update`.
- `u/Crafty-Wonder-7509`, r/ClaudeAI, 2026-04-18 — "making it bigger doesn't seem to fix it, I have to restart CC first".
