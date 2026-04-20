# Does the statusline payload expose the current permission / execution mode?

**Scope:** Status of `#44982` (add permissionMode to statusline JSON) and whether statusline ideas can read the current mode.
**Last updated:** 2026-04-18
**Confidence:** High — direct issue read + docs schema verification + related open issues.

## Answer

**No — not in the payload as of 2026-04-18.** Issue `#44982` is **open**, filed 2026-04-08, 0 comments, no Anthropic response. The published payload schema includes `model`, `agent.name`, `vim.mode`, `output_style.name`, `workspace.git_worktree` — but no field for `permission_mode` / `permissions.level` / `mode`. However, permission-mode changes DO fire a statusline re-render event (per official docs), so scripts can detect the event but not read the value. Workarounds (tail transcript JSONL for `permissionMode`) work but are fragile — and `#48445` breaks even that via Shift+Tab during idle.

## Evidence

- Issue: [`#44982`](https://github.com/anthropics/claude-code/issues/44982), state: open, opened 2026-04-08, 0 comments, labels `enhancement / area:statusline`. Author proposes `mode.name` or `permissions.level` field with values `plan` / `auto-accept` / `accept-edits` / `ask-always`.
- Official docs payload schema (retrieved 2026-04-18) does NOT list any `permission` / `mode` field. Full field inventory: `session_id`, `session_name`, `transcript_path`, `cwd`, `model.{id,display_name}`, `workspace.{current_dir,project_dir,added_dirs,git_worktree}`, `version`, `output_style.name`, `cost.{total_cost_usd,total_duration_ms,total_api_duration_ms,total_lines_added,total_lines_removed}`, `context_window.*`, `exceeds_200k_tokens`, `rate_limits.{five_hour,seven_day}`, `vim.mode`, `agent.name`, `worktree.{name,path,branch,original_cwd,original_branch}`. No permission mode.
- Official docs, How status lines work: "Your script runs after each new assistant message, **when the permission mode changes**, or when vim mode toggles." — the mode change triggers a refresh but the new value is not in the payload.
- Related open: [`#46419`](https://github.com/anthropics/claude-code/issues/46419) "Allow customizing or hiding the permission mode indicator text" — also open, suggests the built-in mode indicator (hardcoded) is what users see, not something scripts can intercept.
- Related open: [`#47345`](https://github.com/anthropics/claude-code/issues/47345) "Allow disabling hardcoded mode indicator in status line" — open. Confirms the built-in indicator is hardcoded, not script-controlled.
- No 2.1.x changelog entry adds permission mode to statusline JSON.

### Workaround (fragile)

- Parse the transcript JSONL at `transcript_path` for the last `"permissionMode"` occurrence:
  ```bash
  grep '"permissionMode"' "$TRANSCRIPT" | tail -1 | jq -r '.permissionMode'
  ```
- This IS how `#48445`'s OP builds their mode indicator — and that's exactly the path that triggers the repaint bug.

### Documented vs inferred

- **Documented:** mode is not in the payload, mode changes fire an event.
- **Inferred:** Anthropic has reasons to gate this (plan-mode leakage to scripts is a minor safety concern). Given 0 comments and no staff reply in ~10 days, no signal this is prioritized.

## Caveats / Negative Signal

- Anthropic added a built-in (hardcoded) permission indicator to the official statusline area — users can't customize it or replace its content (`#46419`, `#47345`). So even if a script wants to show a custom plan-mode badge, the built-in indicator still appears alongside.
- Transcript parsing is O(file size) and can be slow on 50k+ turn sessions. Run via `tail -c 65536` + grep to cap.

## Impact on statusline ideas

- Any idea that needs a *mode-aware* render (plan/accept-edits/auto-accept color coding, plan-mode banner, "safe-mode" tint) — **only doable via transcript parsing**. Will feel slightly stale (event fires, but payload doesn't include the new mode — you need to read the transcript on each event).
- On 2.1.109, the Shift+Tab path is buggy per `#48445` — even the transcript workaround won't repaint between ticks during idle.

## Sources

- `anthropics/claude-code#44982` — 2026-04-08 — primary request, open, 0 comments.
- `anthropics/claude-code#46419` — open — hardcoded mode indicator.
- `anthropics/claude-code#47345` — open — disable hardcoded mode indicator.
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — authoritative schema.
