# Is `context_breakdown` shipping to the statusline payload?

**Scope:** Status of `#49022` (context_breakdown request) and whether per-category token breakdowns (system prompt / tools / memory / skills / messages / autocompact-buffer / free) are available to statusline scripts.
**Last updated:** 2026-04-18
**Confidence:** High — direct issue read, related duplicate `#43898` was closed completed.

## Answer

**Partially shipped, still requested.** `#49022` (filed 2026-04-16, open) is a re-request of an earlier `#43898` "Expose context breakdown by source in status line JSON" — which was **closed as completed on 2026-04-06**. That suggests SOME form of breakdown landed in spring 2026, but the docs as of 2026-04-18 still document only aggregate `context_window.total_input_tokens`, `used_percentage`, `remaining_percentage`, `current_usage.{input,output,cache_creation,cache_read}_tokens`, and `context_window_size`. No `context_breakdown` / `system_prompt_tokens` / `messages_tokens` / `skills_tokens` / `autocompact_buffer_tokens` fields appear in the published schema. Either the closed issue shipped something minimal and docs haven't caught up, or `#49022` was filed because the shipped version didn't match the proposed shape.

## Evidence

- Issue: [`#49022`](https://github.com/anthropics/claude-code/issues/49022), state: open, opened 2026-04-16, labels `enhancement / area:hooks / area:statusline`, 1 comment. Author proposes adding a `breakdown` sub-object to `context_window` with `system_prompt_tokens`, `system_tools_tokens`, `memory_files_tokens`, `skills_tokens`, `messages_tokens`, `autocompact_buffer_tokens`, `free_tokens` — i.e. the same rows `/context` already computes.
- Related closed: [`#43898`](https://github.com/anthropics/claude-code/issues/43898) "[FEATURE] Expose context breakdown by source in status line JSON" — state: closed, reason: completed, closed 2026-04-06, labels `enhancement / area:statusline`.
- Official docs (retrieved 2026-04-18) list `current_usage` with only 4 sub-fields (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`). No per-source breakdown in the published schema.
- No changelog entry 2.1.0–2.1.114 mentions "context breakdown", "category", "system prompt tokens", "messages tokens", or similar.
- Comment on `#49022` (0xbrainkid, 2026-04-16): "`compact-monitor` and similar context-management tools implement [this] today via workarounds" — implying no shipped breakdown exists that those tools can consume.

### Documented vs inferred

- **Documented:** aggregate context stats ARE in the payload; full per-source breakdown IS NOT in the documented schema.
- **Inferred:** the 2026-04-06 close of `#43898` may have shipped a partial breakdown (perhaps just `cache_creation_input_tokens` / `cache_read_input_tokens`, which count as "sources") or may have shipped something un-documented. The new request `#49022` is probably a "docs don't show what I need and `/context` has more info than the JSON" report.

## Caveats / Negative Signal

- Without a confirmed `context_breakdown` object in the payload, any idea that renders per-category bars, `skills` vs `messages` splits, or autocompact-buffer distance needs to (a) compute its own estimate from `total_input_tokens` — which is aggregate only, not per-category; or (b) parse the transcript JSONL at `transcript_path` to reconstruct tokens by source; or (c) wait.
- Parsing the transcript works but is slow (up to MB-sized files) and fragile (format can change). Not recommended for `refreshInterval=1`.
- Payload as documented DOES tell you `current_usage.cache_read_input_tokens`, which is a meaningful "how much came from cache" signal — not nothing, but not a full breakdown.

## Impact on statusline ideas

- Ideas showing a stacked bar of system / tools / memory / skills / messages — **not doable** from payload alone today. Either cap the idea at 2-color (used/free) or parse the transcript offline.
- Ideas showing "autocompact distance" — partially doable. You can compute `(1 - used_percentage/100) * context_window_size`, but you can't subtract the autocompact buffer reservation because you don't know its size from the payload.
- Cache-hit-rate segment — **doable**. `current_usage.cache_read_input_tokens / (cache_read + cache_creation + input_tokens)` is a legitimate "cache efficiency" metric.

## Sources

- `anthropics/claude-code#49022` — 2026-04-16 — primary, requesting breakdown payload.
- `anthropics/claude-code#43898` — closed-completed 2026-04-06 — suggests something shipped but docs don't reflect it.
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — retrieved 2026-04-18 — schema shows no per-source breakdown.
- Anthropic changelog 2.1.0–2.1.114 — reviewed 2026-04-18 — no breakdown-specific entry.
