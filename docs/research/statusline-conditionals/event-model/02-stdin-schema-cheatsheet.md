# What fields does Claude Code put on stdin, and which are "may be absent" vs "may be null"?

**Scope:** The JSON schema Claude Code pipes to every status-line invocation. Only the fields relevant to conditional visibility (absent/null markers, session-scoped stable IDs, time-like fields) are called out here.
**Last updated:** 2026-04-18
**Confidence:** High — verbatim from official docs.

## Answer

Claude Code pipes a single JSON blob to the script's stdin. Roughly 30 fields are documented. For designing conditionals, three groups matter:

1. **Always present** — `session_id`, `model.*`, `workspace.current_dir`, `cost.*`, `context_window.*` (after first API call), `version`, `output_style.name`.
2. **Absent unless feature active** — `session_name` (absent unless `--name`/`/rename`), `workspace.git_worktree` (absent unless in a linked worktree), `vim` (absent unless vim mode on), `agent` (absent unless `--agent`), `worktree` (absent unless `--worktree` session), `rate_limits` (absent for API-key users; absent until first API response for Pro/Max).
3. **Null until first API call** — `context_window.current_usage`, `context_window.used_percentage`, `context_window.remaining_percentage`.

Conditional visibility rules can therefore be expressed purely as field-existence or field-value checks on this blob — no state persistence required for the common cases.

## Evidence

Verbatim stdin schema (official docs, 2026-04-18):

```json
{
  "cwd": "/current/working/directory",
  "session_id": "abc123...",
  "session_name": "my-session",
  "transcript_path": "/path/to/transcript.jsonl",
  "model": { "id": "claude-opus-4-7", "display_name": "Opus" },
  "workspace": {
    "current_dir": "/current/working/directory",
    "project_dir": "/original/project/directory",
    "added_dirs": [],
    "git_worktree": "feature-xyz"
  },
  "version": "2.1.90",
  "output_style": { "name": "default" },
  "cost": {
    "total_cost_usd": 0.01234,
    "total_duration_ms": 45000,
    "total_api_duration_ms": 2300,
    "total_lines_added": 156,
    "total_lines_removed": 23
  },
  "context_window": {
    "total_input_tokens": 15234,
    "total_output_tokens": 4521,
    "context_window_size": 200000,
    "used_percentage": 8,
    "remaining_percentage": 92,
    "current_usage": {
      "input_tokens": 8500, "output_tokens": 1200,
      "cache_creation_input_tokens": 5000, "cache_read_input_tokens": 2000
    }
  },
  "exceeds_200k_tokens": false,
  "rate_limits": {
    "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 },
    "seven_day": { "used_percentage": 41.2, "resets_at": 1738857600 }
  },
  "vim": { "mode": "NORMAL" },
  "agent": { "name": "security-reviewer" },
  "worktree": {
    "name": "my-feature",
    "path": "/path/to/.claude/worktrees/my-feature",
    "branch": "worktree-my-feature",
    "original_cwd": "/path/to/project",
    "original_branch": "main"
  }
}
```

**Absence markers (verbatim, official docs):**

> "Fields that may be absent (not present in JSON):
> - `session_name`: appears only when a custom name has been set with `--name` or `/rename`
> - `workspace.git_worktree`: appears only when the current directory is inside a linked git worktree
> - `vim`: appears only when vim mode is enabled
> - `agent`: appears only when running with the `--agent` flag or agent settings configured
> - `worktree`: appears only during `--worktree` sessions
> - `rate_limits`: appears only for Claude.ai subscribers (Pro/Max) after the first API response in the session. Each window (`five_hour`, `seven_day`) may be independently absent."

**Null markers (verbatim):**

> "Fields that may be `null`: `context_window.current_usage` is `null` before the first API call in a session. `context_window.used_percentage`, `context_window.remaining_percentage` may be `null` early in the session."

**Stable session key (verbatim, from the cache-expensive-operations example):**

> "Process-based identifiers like `$$`, `os.getpid()`, or `process.pid` change on every invocation and defeat the cache. Use the `session_id` from the JSON input instead: it's stable for the lifetime of a session and unique per session."

## Caveats / Negative Signal

- `used_percentage` is **input-only** — `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, explicitly excluding `output_tokens`. Any `when: ctx_used_pct > X` rule should match that semantic.
- `total_duration_ms` is the only monotonic wall-clock field that advances reliably across invocations — but only between messages. Inside a single render, it is a fixed snapshot.
- `exceeds_200k_tokens` is a **fixed threshold flag**, not a percentage. Useful for a boolean `when: exceeds_200k_tokens == true` rule.
- `rate_limits` absence is ambiguous: could be API-key user OR Pro/Max before first response. Don't use absence to infer plan.

## Sources

- [Customize your status line — Available data](https://code.claude.com/docs/en/statusline#available-data) — Anthropic official docs — scraped 2026-04-18.
