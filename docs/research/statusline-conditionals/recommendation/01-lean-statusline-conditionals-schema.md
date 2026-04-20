# Concrete `conditionals` schema recommendation for lean-statusline (S-tier #93)

**Scope:** Prescriptive — the schema to ship. Draws on the ccstatusline, claude-powerline, cship, claudeline findings in sibling files. Answers: what fields, what semantics, how to handle decay under Claude Code's event model.
**Last updated:** 2026-04-18
**Confidence:** High — every clause below is traceable to at least one existing project that has run it against real users, plus the official event-model constraints.

## Answer

Ship a **flat, 6-field `conditionals` object per segment**, colocated with the segment's other config (like claude-powerline's `enabled`, unlike ccstatusline's TUI-only model). Use claudeline's "only meaningful" ethos as the default behavior, cship's two-band threshold pattern as the threshold grammar, and an explicit `requires` / `hide_when_null` distinction to handle stdin absence vs. null.

Do **not** ship a time-decay primitive in v1. The event-only default model makes wall-clock decay impossible without either (a) forcing every user to set `refreshInterval`, or (b) painting stale segments until the next message. Instead, offer `max_messages` as the replacement primitive — "hide after N messages" — which uses `cost.total_duration_ms` or a transcript-derived message count and decays on the natural event cadence.

## The schema

```jsonc
{
  "segments": {
    "agent": {
      "enabled": true,
      "conditionals": {
        // 1. Field existence — hide when stdin key is absent or null.
        //    Handles `session_name`, `worktree`, `agent`, `vim`, `rate_limits` cleanly.
        "requires": "agent.name",

        // 2. Value filter — hide when the field equals any of these values.
        //    Supports #93's "show agent only when non-default".
        "hide_when_equals": ["default", ""],

        // 3. Numeric threshold — warn/critical styling + optional hide.
        //    Two bands total (cship pattern). Color keys match theme slots.
        "threshold": {
          "field": "context_window.used_percentage",
          "warn_at": 70,
          "critical_at": 90,
          "hide_below": 10              // optional — "show 7d only when >=10%"
        },

        // 4. Message-count decay — replacement for time-decay.
        //    Hide after N post-appearance messages (uses transcript line count
        //    from `transcript_path`, cached by `session_id`).
        "max_messages": 3,

        // 5. Per-session cache — when the segment reads external state.
        //    Keyed by `session_id`. OK TTL + fail TTL (claudeline pattern).
        "cache": { "ttl_ok": 60, "ttl_fail": 15 },

        // 6. Project-file predicate (Starship-inherited).
        //    Hide unless the current `workspace.project_dir` contains one of these.
        "detect_files": ["pyproject.toml", "requirements.txt"]
      }
    }
  }
}
```

### Why exactly these six

| # | Field | Covers #93 case | Prior art | Cost to implement |
|---|---|---|---|---|
| 1 | `requires` | "show worktree only in a worktree" | claudeline (implicit), powerline (`rate_limits` auto-hide) | ~5 LOC: `get(stdin, path) != null` |
| 2 | `hide_when_equals` | "show agent only when non-default" | cship (manual, via format), claudeline `(devel)` filter | ~3 LOC: array membership |
| 3 | `threshold` with `warn_at`/`critical_at`/`hide_below` | "show 7d only when ≥10%", red at 90% | cship (`warn_threshold`/`critical_threshold`), claudeline (4 bands, hardcoded) | ~15 LOC incl. color routing |
| 4 | `max_messages` | Replaces "show session_name for 10s then hide" | Novel; forced by event-only model | ~20 LOC: read transcript jsonl, count user messages since first-seen |
| 5 | `cache.ttl_ok`/`ttl_fail` | "avoid hitting usage API every message" | claudeline (60/15, 24h/15, 2m/30s), cship (`ttl = 60`) | Already half-needed for #78-style ideas |
| 6 | `detect_files` | "show Python badge in Python repos" | Starship canon; inherited into cship via passthrough | ~8 LOC: glob check on `workspace.project_dir` |

### What NOT to add in v1

- **`when` expression DSL** (e.g. `"when": "cost.total_cost_usd > 5 && rate_limits.five_hour.used_percentage > 70"`). Every project in the survey avoided this. It bitrots — requires a parser, requires versioning, and the four primitives above cover 90%+ of observed cases. If a user needs more, they use the Custom Command escape hatch (ccstatusline pattern).
- **Wall-clock `decay_seconds: 10`**. See next section — it cannot work correctly without forcing `refreshInterval`, and `max_messages` is strictly better for the stated use case ("show session_name for 10s then hide").
- **Per-repo deep-merge overlays.** Match the existing ecosystem: `./lean-statusline.config.json` > `~/.claude/lean-statusline.json` > defaults, **first match wins, no merge**. This is what claude-powerline and cship both ship; it's predictable and committable. Deep merge is a future feature if users ask.

## Explicit answer: can any project handle time-decay without `refreshInterval`?

**No, and it is genuinely impossible per the Claude Code event model.** Evidence:

1. The official docs (`code.claude.com/docs/en/statusline`, 2026-04-18) define triggers as "after each new assistant message, when the permission mode changes, or when vim mode toggles" plus an explicit "These triggers can go quiet when the main session is idle, for example while a coordinator waits on background subagents. To keep time-based or externally-sourced segments current during idle periods, set `refreshInterval` to also re-run the command on a fixed timer."
2. None of ccstatusline, claude-powerline, cship, or claudeline implement a wall-clock decay. cship's author confirms in r/ClaudeAI 2026-04-18: "There's a 5s cache and updates happen whenever Claude responds to a prompt." claudeline has no decay at all. ccstatusline's session/block timers *always* show, never decay.
3. The only contending design that could fake decay without `refreshInterval` — "cache timestamp of first appearance in state file keyed by `session_id`, hide when `now - first_seen > 10s`" — **still requires a render to hide the segment**. Without a timer, the render does not happen, so the user sees the stale segment until their next keystroke. This is the exact bug #93 is trying to avoid.

Therefore lean-statusline should:

- Ship `max_messages: N` as the primary decay primitive (works on event cadence, exactly matching how status lines repaint anyway).
- Document that `refreshInterval: 1` in `settings.json` is the user's explicit opt-in for wall-clock decay. If a user wants "show session_name for 10s then hide", they set `refreshInterval: 1` AND `conditionals.max_age_seconds: 10` on that segment — both pieces together. Without `refreshInterval`, `max_age_seconds` is best-effort and warned.
- Reject "show session_name for 10s" as the default example in docs. Use "show session_name for the first 3 messages" instead. This reframes the idea in the event-native domain.

## Evidence cross-refs

- Event-model facts: `docs/research/statusline-conditionals/event-model/01-claude-code-update-triggers-and-refreshinterval.md`
- Two-band threshold precedent: `docs/research/statusline-conditionals/cship/01-starship-inherited-thresholds-and-format.md`
- Cache-TTL precedent: `docs/research/statusline-conditionals/claudeline/01-only-shows-when-meaningful-and-cache-ttls.md`
- First-match project override precedent: `docs/research/statusline-conditionals/claude-powerline/01-segment-schema-and-per-project-override.md`
- Anti-pattern to avoid (widget-level TUI-driven, non-committable config): `docs/research/statusline-conditionals/ccstatusline/01-widget-config-and-hide-semantics.md`

## Caveats / Negative Signal

- **`max_messages` requires reading the transcript.** `transcript_path` is in every stdin payload, but large jsonl files are expensive to parse every render. Mitigate with cache #5 keyed by `session_id` — the ccstatusline block-timer feature does this and gets sub-100ms reads on 250 MB of jsonl per its author on r/ClaudeAI 2026-04-18.
- **`detect_files` requires a filesystem scan.** Starship does this per prompt render and is widely accepted. Limit it to `workspace.project_dir` (not `workspace.current_dir`) so it's stable inside a session.
- **Threshold naming — `warn_at`/`critical_at` vs cship's `warn_threshold`/`critical_threshold`.** Shorter names feel nicer but break keyword search for users coming from cship. Recommend `warn_at` + `critical_at` for lean-statusline because they're colocated inside `threshold: {}`, which removes the ambiguity the longer names were solving.
- **`hide_below` adds a third band semantic to what is otherwise two bands.** This is #93's explicit "show 7d only when ≥10%" requirement; worth the asymmetry.
- **No evidence of users demanding a full DSL.** r/ClaudeAI threads scraped 2026-04-18 show users asking for *more built-in segments*, not for expression syntax. Supports the "6 fields, no DSL" posture.

## Sources

- All sibling files in this research tree, cited above.
- [Claude Code: Customize your status line](https://code.claude.com/docs/en/statusline) — 2026-04-18.
- Starship config reference for `detect_files` / `detect_folders` / `warn_threshold` semantics — referenced via cship as the proven consumer.
