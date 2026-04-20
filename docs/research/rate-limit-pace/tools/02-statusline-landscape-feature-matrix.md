# Which Claude Code statuslines show pace/burn-rate and how do they implement it?

**Scope:** Feature matrix across 10+ published statuslines, focused on pace-related features: pace indicator, projected ETA, reset countdown, multi-session behavior, and data source. Excludes pure formatters (ccstatusline v2.x core) that only render upstream data.
**Last updated:** 2026-04-18
**Confidence:** High for inspected tools; Medium for those known only by README.

## Answer

Of the ten published statuslines surveyed, **claude-pace** is the only one that (a) computes a signed pace delta via subtraction, (b) reads stdin exclusively (no OAuth API calls), and (c) is a single-file bash script. **vfmatzkin/claude-statusline** and **damiafuentes prompt-spec** use projection-ratio math and surface an ETA. **ccusage / TahaSabir0 / isaacaudet / aiedwardyi** call `/api/oauth/usage` and hit rate-limit issues in multi-session use. **kcchien/claude-code-statusline** features a gradient progress bar, and **isaacaudet** + **aiedwardyi** implement adaptive width collapse. ccstatusline (sirmalloc) is a formatter with Usage/Weekly widgets (v2.1.0+) but no native pace logic.

## Evidence

### Feature matrix

| Tool | Runtime | Data source | Pace display | Projected ETA | Reset countdown | Terminal-aware collapse |
|---|---|---|---|---|---|---|
| **claude-pace** (Astro-Han) | bash+jq | stdin `rate_limits` | ⇡/⇣ signed delta | No | Yes (m/h/d) | No |
| **vfmatzkin/claude-statusline** | bash | stdin `rate_limits` | ↑/→/↓ + urgency color | Yes (`↑ 2h`) | Yes | No |
| **damiafuentes** (prompt spec only) | node | stdin `rate_limits` | projected% with `out ~Xh` / `out ~Wed` | Yes (5h in h/m; 7d in day-of-week) | Yes | No |
| **daniel3303/ClaudeCodeStatusLine** | bash/powershell | OAuth `/api/oauth/usage` | Color-coded % only (no pace) | No | Yes | No |
| **isaacaudet/claude-code-statusline** | bash | OAuth `/api/oauth/usage` | Color-coded % only | No | Yes (shown as clock time / date) | **Yes — 4-tier by width** |
| **aiedwardyi/claude-usage-monitor** | python | OAuth `/api/oauth/usage` | Optional `CQB_PACE` env (undocumented math) | No | Yes | **Yes — `CQB_MAX_WIDTH` with segment-drop priority** |
| **TahaSabir0/Best-ClaudeCode-statusline** | node | OAuth `/api/oauth/usage` | Color-coded % + blinking red | No | Yes (5h only) | No |
| **ryoppippi/ccusage statusline** | bun/node | Transcript JSONL + stdin cost | Cost burn rate $/hr | No (cost-based) | "Block" remaining, not rate-limit reset | No |
| **sirmalloc/ccstatusline** (v2.1.0+) | node | stdin `rate_limits` | Widgets only, no native pace | No | Block Reset Timer, Weekly Reset Timer widgets | Config-driven via "flex separators" |
| **Haleclipse/CCometixLine** | Rust | transcript analysis | "Usage % (planned)" per claude-pace comparison | No | No | No |
| **kcchien/claude-code-statusline** | bash | local session | None (cost tracking + gradient context bar) | No | No | No (per repo description: "smart hiding") |

### Execution-time / resource benchmarks (from claude-pace README, Apple Silicon, 300 runs)

| Tool | Exec time | Memory |
|---|---|---|
| claude-pace | ~10ms | ~2 MB |
| CCometixLine | ~5ms | ~3 MB |
| ccstatusline | ~90ms | ~57 MB |
| claude-hud | ~90ms | ~57 MB |

**Inference:** bash+jq and Rust statuslines are ~10× faster and ~20× lighter than node-based statuslines. Claude Code polls every ~300ms, so ~90ms-per-invocation statuslines can cause measurable terminal UI lag — consistent with r/ClaudeAI `1mlweli` reports of runaway ccusage processes.

### Why the OAuth-endpoint statuslines hit multi-session issues

All of daniel3303, isaacaudet, aiedwardyi, TahaSabir0 call `GET https://api.anthropic.com/api/oauth/usage`. Mitigations each ship:
- daniel3303: 60-second cache at `/tmp/claude/statusline-usage-cache.json`
- isaacaudet: 1-hour cache, **stale-good fallback on API error** (never overwrites cache with a failure)
- aiedwardyi: 5-minute cache, lock file to serialize concurrent writes
- TahaSabir0: 30-second cache shared across sessions
- ccusage: not applicable — uses transcript JSONL

Even with these caches, running 5+ concurrent CC sessions makes the endpoint rate-limit and any statusline that doesn't handle 429 gracefully shows `-%`. This is the core argument for stdin-only sourcing.

### The gradient progress bar (kcchien specifically)

kcchien's README (inspected via GitHub profile listing — repo description only): "gradient progress bar, smart hiding, git status, cost tracking." "Smart hiding" implies: hide components when they're at default / empty state rather than rendering zeros. The gradient itself (per the handful of statuslines that implement gradients) is typically:

- Green → yellow → orange → red as percent crosses 50 / 70 / 90.
- Some tools use a **blink** flag at ≥90% (TahaSabir0, the damiafuentes spec at ≥85%).

No inspected statusline uses terminal-256-color or truecolor gradients across the bar; all use solid-color bars with the color chosen by the current percent. The word "gradient" in kcchien's description most plausibly refers to the stepped progression across the percentage scale rather than a smooth gradient within one bar.

### The adaptive width pattern (isaacaudet, aiedwardyi)

From isaacaudet README:

| Width | What's shown |
|---|---|
| ≥ 150 | Everything: cwd, branch, ↑↓, tokens, thinking, cost, 5h + 7d bars |
| 100–149 | Branch, ↑↓, tokens, thinking, cost, 5h bar with reset time |
| 76–99 | Branch, ↑↓, tokens, thinking symbol, 5h bar |
| < 76 | Short model name, branch, tokens |

Detected via `stty`. Override with `TERM_WIDTH` env.

aiedwardyi: `CQB_MAX_WIDTH` default 80; low-priority segments (tokens, duration) drop when line overflows. The tier is priority-ordered rather than width-ordered, which is more configurable.

**Inference:** For lean-statusline's reset-countdown-collapse UX (idea #44), the isaacaudet pattern is the correct reference — drop the weekly window first (it's the lowest-information-per-pixel segment when space is tight), then drop the reset countdown, then the pace delta, finally leaving only `5h NN%`.

## Caveats / Negative Signal

- Some tools (damiafuentes) were only available as a prompt spec; the actual script was not published. The math was specified precisely in the post, but the production behavior is uninspected.
- kcchien was read from GitHub profile metadata only; the full README was not retrieved. The "gradient progress bar" description is not confirmed source-side.
- Execution benchmarks are from claude-pace's own README; self-reported comparisons have a known bias. However the ~10× gap between bash and node is consistent with general-purpose knowledge of node startup time.
- The feature matrix omits pure plugin/Deno/Windows-only variants (b-open-io/statusline, spences10/claude-statusline-powerline etc.) that did not surface documented pace logic.

## Sources

- [Astro-Han/claude-pace](https://github.com/Astro-Han/claude-pace) — v0.8.0 README + source — 2026-04-13
- [vfmatzkin/claude-statusline](https://github.com/vfmatzkin/claude-statusline) — README — 2026-02~
- [daniel3303/ClaudeCodeStatusLine](https://github.com/daniel3303/ClaudeCodeStatusLine) — README — 2026-03~
- [isaacaudet/claude-code-statusline](https://github.com/isaacaudet/claude-code-statusline) — README — 2026-03~
- [aiedwardyi/claude-usage-monitor](https://github.com/aiedwardyi/claude-usage-monitor) — README v0.1.5 — 2026-03~
- [TahaSabir0/Best-ClaudeCode-statusline](https://github.com/TahaSabir0/Best-ClaudeCode-statusline) — README — 2026-03~
- [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage) — README — 2026-04~
- [sirmalloc/ccstatusline](https://github.com/sirmalloc/ccstatusline) — README, v2.1.0+ changelog — 2026-04~
- [Haleclipse/CCometixLine](https://github.com/Haleclipse/CCometixLine) — README — 2026-03~
- [github.com/kcchien](https://github.com/kcchien) — repo listing — 2026-04~
- [r/ClaudeCode/comments/1sksf4p](https://reddit.com/r/ClaudeCode/comments/1sksf4p) — damiafuentes prompt spec — 2026-04
