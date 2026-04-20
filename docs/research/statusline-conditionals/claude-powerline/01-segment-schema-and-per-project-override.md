# How does claude-powerline express per-segment visibility and per-project overrides?

**Scope:** Owloops/claude-powerline (npm `@owloops/claude-powerline`, ~1k stars, zero-dep TypeScript, wizard-configured JSON). Focus: segment `enabled` flag, threshold wiring, per-project config, auto-hide behavior.
**Last updated:** 2026-04-18
**Confidence:** High — README and reference config file scraped in full.

## Answer

claude-powerline uses a **flat `enabled: boolean` per segment**, plus a small set of per-segment `show*` flags (e.g. `showSha`, `showWorkingTree`, `showTag`) that are themselves booleans — **not conditional rules**. It has a real `budget` block with `warningThreshold` (percentage) that drives color state on the `session` / `today` / `block` segments. It supports **per-project overrides** via a three-tier lookup (`./.claude-powerline.json` > `~/.claude/claude-powerline.json` > `~/.config/claude-powerline/config.json`), with CLI flags > env vars > config-files > defaults. Config files **reload automatically** (no restart). Two segments **auto-hide when data is unavailable** — `block` and `weekly` both hide silently when `rate_limits.*` is absent from stdin; `env` hides when the named variable is unset. There is **no show-when DSL, no decay, no first-N-turns primitive**.

## Evidence

**Per-segment enable flag (verbatim, from `.claude-powerline.json`):**

```json
"git": {
  "enabled": true,
  "showSha": true,
  "showWorkingTree": true,
  "showOperation": true,
  "showTag": true,
  "showTimeSinceCommit": true,
  "showStashCount": true,
  "showUpstream": true,
  "showRepoName": true
}
```

All segments follow this `enabled + show* bool flags` shape. No segment supports `when:` or `hideWhen:`.

**Threshold config (verbatim, README Budget block):**

```json
"budget": {
  "session": { "amount": 10.0, "warningThreshold": 80 },
  "today":   { "amount": 25.0, "warningThreshold": 80 },
  "block":   { "amount": 15.0, "type": "cost", "warningThreshold": 80 }
}
```

README: "Indicators: `25%` Normal • `+75%` Moderate (50-79%) • `!85%` Warning (80%+)". So there are **three hard-coded bands** (normal, moderate ≥50%, warning ≥ configured `warningThreshold`). Users cannot add a fourth band, nor can they set a custom color per band — they get prefix glyphs only. The "critical" color is wired via theme variants `contextWarning` / `contextCritical` in the `colors.custom.*` block.

**Per-project override (verbatim, README Configuration section):**

> "Config locations (in priority order):
> - `./.claude-powerline.json` - Project-specific
> - `~/.claude/claude-powerline.json` - User config
> - `~/.config/claude-powerline/config.json` - XDG standard
>
> Override priority: CLI flags > Environment variables > Config files > Defaults
>
> Config files reload automatically, no restart needed."

Note: docs say "priority order" for config locations but do **not** explicitly say project + user merge. Behaviour appears to be **first-match-wins** (project replaces user), not a deep merge. This is a notable limitation if you want to override just one segment per repo.

**Auto-hide on missing data:** From README:

- Block segment: "Requires Claude Code's native `rate_limits` hook data (Claude.ai Pro/Max subscribers)... **Hidden when native data is unavailable.**"
- Weekly segment: "Only visible when Claude Code provides native `rate_limits.seven_day` data... **Hidden when the data is not available.**"
- Env segment: "Hidden when the variable is unset or empty."

This is hard-coded per-segment logic, not expressed as config — users can't author their own "hide when X is null" rule.

**TUI grid `display.tui.breakpoints` engine:** A legitimately powerful layout DSL with responsive `minWidth` breakpoints, CSS-grid-like `areas`/`columns`/`align`. This is the closest thing to a conditional in the project, but it's a **layout switch**, not a segment-visibility rule — a dropped cell goes to the layout `.` placeholder, not an empty string.

**Decay / time-based:** Not supported. No `refreshInterval` wiring documented. The `metrics` segment shows time-since-last-response but always renders — it has no "only show for N seconds" mode.

## Caveats / Negative Signal

- **No deep merge between project and user config.** Discovered by structural inspection of the priority list. Confirmed it's presented as a fallback, not a layered merge. Users who want "repo adds `env` segment but keeps user's theme" still need to duplicate the entire theme block in the project file.
- **`warningThreshold` is single-band.** Only one threshold per budget target. `cship` (separate project) offers `warn_threshold` + `critical_threshold` per module — strictly more expressive.
- **No `when` on segments.** No way to express "show `agent` only when `agent.name != 'default'`" — the segment is either always on or always off.
- **User pain (r/ClaudeAI thread, 2026-04-18, u/jivenossauro):** "In the vscode terminal, powershell, windows 10... a newline was being created whenever any char updated in the claude code terminal." Rendering pathology unrelated to schema but illustrates the cost of long/complex segments.
- **Positive signal (r/ClaudeAI, u/-nixx OP):** "Only showing what can be measured accurately rather than potentially misleading subscription percentages." — this "show when meaningful" ethos is encoded per-segment rather than as a general rule, and competes well with ccstatusline by being opinionated.

## Sources

- [Owloops/claude-powerline README](https://github.com/Owloops/claude-powerline) — scraped 2026-04-18.
- [.claude-powerline.json reference config](https://raw.githubusercontent.com/Owloops/claude-powerline/main/.claude-powerline.json) — fetched 2026-04-18.
- `u/-nixx` (author), r/ClaudeAI, "claude-powerline: A Lightweight, Secure Statusline", scraped 2026-04-18 — thread with author motivation and user feedback.
- `u/jivenossauro`, r/ClaudeAI, 2026-04-18 — Windows terminal newline bug report.
