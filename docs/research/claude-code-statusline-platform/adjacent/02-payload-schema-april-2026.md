# What fields does the statusline JSON payload actually contain (April 2026)?

**Scope:** Authoritative inventory of stdin JSON fields available to `statusLine.type: "command"` scripts, with presence rules.
**Last updated:** 2026-04-18
**Confidence:** High — pulled directly from `code.claude.com/docs/en/statusline`, cross-checked with changelog, cross-checked with recently-closed payload-addition issues.

## Answer

The payload is flatter and simpler than any per-field feature request would suggest. What ships: session IDs + transcript path, model info, workspace/worktree, cost aggregates, context window (aggregate + recent-call), rate limits, vim mode, agent name, output style, and a few conditional fields. **effortLevel and skills/subagents are newly shipped (April 2026) but not yet in the docs schema.** Terminal dimensions (columns/rows) shipped via `#41512` but documentation of the field name is limited — likely `terminal.columns` / `terminal.rows`.

## Full documented schema (as of 2026-04-18)

```jsonc
{
  "cwd": "/current/working/directory",
  "session_id": "abc123...",
  "session_name": "my-session",               // absent if never /rename'd or --name'd; also auto-name sessions have no payload name (#49913)
  "transcript_path": "/path/to/transcript.jsonl",
  "model": {
    "id": "claude-opus-4-7",
    "display_name": "Opus"
  },
  "workspace": {
    "current_dir": "/current/working/directory",
    "project_dir": "/original/project/directory",
    "added_dirs": [],
    "git_worktree": "feature-xyz"             // absent in main tree; set when cwd is inside a `git worktree add` linked worktree
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
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  },
  "exceeds_200k_tokens": false,                // fixed 200k threshold, regardless of actual window size
  "rate_limits": {                             // only for Pro/Max subscribers after first API response
    "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 },
    "seven_day": { "used_percentage": 41.2, "resets_at": 1738857600 }
  },
  "vim": { "mode": "NORMAL" },                 // absent when vim mode is off
  "agent": { "name": "security-reviewer" },    // absent unless --agent flag or agent config active
  "worktree": {                                // present only during --worktree sessions (different from workspace.git_worktree)
    "name": "my-feature",
    "path": "/path/to/.claude/worktrees/my-feature",
    "branch": "worktree-my-feature",
    "original_cwd": "/path/to/project",
    "original_branch": "main"
  }
}
```

## Fields that shipped in April 2026 (not yet in docs schema)

- `effortLevel` (or similar) — `#47780`, `#43428`, `#45003`, `#47722` all closed completed April 2026. Exact field name unclear from issue text (some reporters used `effort`, some `effortLevel`, some `thinking_budget`). Likely one of these lands in the payload.
- **Skills + subagents** — `#47857` closed completed 2026-04-14. Some representation of "currently running skill" and "currently running subagents" is in the payload. Field name unknown.
- **Terminal dimensions** — `#41512` closed completed 2026-04-01. Almost certainly `terminal.columns` / `terminal.rows` or similar nested object.
- **Some form of context breakdown** — `#43898` closed completed 2026-04-06. Shape unknown; docs schema still shows only aggregate. `#49022` re-requests it because users can't see breakdown granularity.

## Fields NOT in the payload (confirmed)

- **Permission mode / execution mode** (`#44982` open) — transcript-parsing is the only workaround, event fires but value is not in payload.
- **Auto-compact threshold** (`#46428` open) — can't compute exact distance to compaction.
- **Account balance** (`#46329` open) — session cost is in payload, organization/account balance is not.
- **Background task counts** (`#46778` closed not_planned) — explicitly declined.
- **Auto-generated session title** (`#49913` open) — only the `/rename` name is in payload; sessions renamed by auto-title don't populate `session_name`.
- **Session color** (`/color` command state) — not in payload. `#44245` asks for control messages to set it from the script.

## Fields that drift or are unreliable

- `context_window.used_percentage` — `#42646` open — includes cache_read tokens, can be inflated after `/clear`.
- Rate limits — only populate after first API response for Pro/Max subscribers; absent for API-key users.
- `cost.total_lines_added/removed` — `#41366` open — can be stale.
- Cross-session aggregates — `#41377` open, `#49935` / `#49927` open — `used_percentage` can flicker between concurrent sessions.

## Payload additions that will likely land next

Based on issue volume and staff signal:
1. Permission mode field (`#44982` + friends) — probably next, but no assignee.
2. Context breakdown granularity re-shipped (`#49022`) — already shipped once, needs second pass.
3. Auto-generated session title (`#49913`) — small, obvious.
4. Auto-compact threshold (`#46428`) — small, obvious.

## Sources

- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — retrieved 2026-04-18 — authoritative schema.
- Closed-completed issues: `#41512`, `#42418`, `#42469`, `#42637`, `#42710`, `#43431`, `#43428`, `#43898`, `#44927`, `#45003`, `#45973`, `#47025`, `#47722`, `#47780`, `#47857`, `#41494` — reviewed 2026-04-18.
- Open issues inventory — `gh api search/issues?q=repo:anthropics/claude-code+is:issue+label:area:statusline` — retrieved 2026-04-18.
- Anthropic changelog `CHANGELOG.md` — reviewed 2026-04-18.
