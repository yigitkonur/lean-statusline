# Which signals come free from stdin vs require transcript parsing?

**Scope:** The native JSON passed to a statusline script on stdin (documented, stable) vs what requires cracking the transcript JSONL.
**Last updated:** 2026-04-18
**Confidence:** High — from Claude Code docs + `Haleclipse/CCometixLine` `InputData` struct (the superset of fields currently passed).

## Answer

**Everything a minimal statusline needs** — model, cwd, cost, duration, lines added/removed, transcript_path, session_id — **is in stdin, free**. What requires transcript parsing: running tools, subagent count, last-tool latency, failed-tool streak, todo list state, cache-hit ratio, per-turn token usage. Token *counts* live in both places but with different semantics: stdin's `context_window.used_percentage` is cumulative context window; transcript `usage.input_tokens` is per-turn.

## Evidence

### Fields passed on stdin (confirmed by CCometixLine's `InputData`)

From `src/config/types.rs` lines 88–120:

```rust
pub struct Model {
    pub id: String,
    pub display_name: String,
}
pub struct Workspace {
    pub current_dir: String,
}
pub struct Cost {
    pub total_cost_usd: Option<f64>,
    pub total_duration_ms: Option<u64>,
    pub total_api_duration_ms: Option<u64>,
    pub total_lines_added: Option<u32>,
    pub total_lines_removed: Option<u32>,
}
pub struct OutputStyle { pub name: String }
pub struct InputData {
    pub model: Model,
    pub workspace: Workspace,
    pub transcript_path: String,
    pub cost: Option<Cost>,
    pub output_style: Option<OutputStyle>,
}
```

And from `anthropics/claude-code#11535` (2025-11) which shows the real payload:

```json
{
  "session_id": "...",
  "transcript_path": "...",
  "cwd": "/workspace",
  "model": { "id": "claude-sonnet-4-5-20250929", "display_name": "Sonnet 4.5" },
  "workspace": { "current_dir": "/workspace", "project_dir": "/workspace" },
  "version": "2.0.37",
  "output_style": {"name": "default"},
  "cost": {
    "total_cost_usd": 4.267483249999999,
    "total_duration_ms": 2257641,
    "total_api_duration_ms": 951022,
    "total_lines_added": 2109,
    "total_lines_removed": 103
  },
  "exceeds_200k_tokens": false
}
```

Added later (Claude Code 2.0.x → 2.1.x) per claude-hud docs and the Claude Code statusline page:
- `context_window.context_window_size` — max context for current model
- `context_window.current_usage.input_tokens` — current cumulative input
- `context_window.used_percentage` — pre-calculated percentage
- `rate_limits.five_hour.used_percentage` + `resets_at`
- `rate_limits.seven_day.used_percentage` + `resets_at`

### Free from stdin (no transcript parse needed)

- Model name and id
- CWD / project dir
- Session id
- Cost $, total_duration_ms, API duration, lines added/removed (since session start)
- Context window size + cumulative usage + percentage
- 5h and 7d rate-limit utilization + reset timestamps
- Output style name
- Claude Code version string

### Requires transcript parsing

| Signal | Where it lives |
|---|---|
| Running tool right now | Most-recent `tool_use` block with no matching `tool_result` by `tool_use_id` |
| Last-used tool | Most-recent `tool_use` block |
| Last-tool latency | `tool_result.timestamp - tool_use.timestamp` for matched ids |
| Failed-tool streak | Walk back through `tool_result.is_error === true` until a non-error |
| Subagent count | `tool_use` with `name === 'Task'` (optionally cross-check sidechain file exists) |
| Todo list | `tool_use` with `name === 'TodoWrite'` — last one wins |
| Cache-efficiency ratio | `sum(cache_read_input_tokens) / sum(input_tokens + cache_creation_input_tokens + cache_read_input_tokens)` across assistant records |
| Per-turn token breakdown | `assistant.message.usage` |

### claude-hud config surface confirms this split

From claude-hud's README, the stdin-only lines are on by default:

> "Line 1 — Model, provider label, project path, git branch. Line 2 — Context bar and usage rate limits."

The transcript-dependent lines are all opt-in (`display.showTools`, `display.showAgents`, `display.showTodos`). This is not an accident: the author charges opt-in for the features that cost real parse time.

## Caveats / Negative Signal

- **context_window.current_usage.input_tokens is not always accurate.** Claude Code's own `/context` command and the statusline stdin number disagree in some sessions (no citation pinned; observed repeatedly in Reddit statusline posts). For a belt-and-braces approach, parsing the transcript last-assistant `message.usage` gives an independent number.
- **`exceeds_200k_tokens` is a boolean**, useless for anything nuanced (see claude-code#11535 workaround section). But it was the only token signal pre-2.0.37.
- **Cost.total_cost_usd is reported as `null` for some provider configs** (direct Anthropic works; Bedrock / Vertex users have seen it blank — observed in cc-statusline docs). Transcript-based cost requires applying a price table to the cached/non-cached token split, which is what `ccusage` does and why it exists.
- **Rate limit fields are only populated for subscribers.** API key users get nothing here. Per Claude Code docs: "Subscriber 5-hour rate limit usage when provided."

## Sources

- `anthropics/claude-code#11535` — exact stdin JSON payload — 2025-11-13 — [issue](https://github.com/anthropics/claude-code/issues/11535)
- `code.claude.com/docs/en/statusline` — official statusline field list, `refreshInterval`, debounce — fetched 2026-04-18
- `Haleclipse/CCometixLine` — `src/config/types.rs` — InputData struct — fetched 2026-04-18
- `jarrodwatts/claude-hud` — `CLAUDE.md` "Data Sources" — fetched 2026-04-18
