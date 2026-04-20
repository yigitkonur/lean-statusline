# Is transcript parsing viable for a Node statusline with a 200ms render budget?

**Scope:** Direct verdict answering the question. Applies specifically to `lean-statusline` (zero-dep Node, 300ms debounce, in-flight cancellation). Reweights D-tier ideas #23, #24, #87, #88 and B-tier #38.
**Last updated:** 2026-04-18
**Confidence:** High — verdict is grounded in source code of the two biggest transcript-parsing statuslines, their caching patterns, and confirmed schema behavior.

## Answer

**Yes, viable — conditionally.** Transcript parsing at ~200ms is comfortably achievable in Node if you do two things claude-hud does not: (1) use a **byte-offset bookmark** instead of a full re-read on every event, and (2) keep the parsed-state reducer minimal (just the signals you actually display). With that architecture, the hot path is a stat + `fs.read(range)` + `JSON.parse` of ~1–10 new lines + in-memory merge — single-digit milliseconds end-to-end on sessions up to 100 MB. Without the bookmark, you inherit claude-hud's fate: a full re-read on every event that scales O(session size). Acceptable up to ~5–10 MB on modern machines; degrades beyond that.

## The matrix — which ideas pass, which don't

Re-scoring against the evidence:

| Idea | Original | Verdict | Reasoning |
|---|---|---|---|
| **#23 subagent count** | D | **B** (with bookmark) / C (without) | Count `tool_use` blocks with `name === 'Task' \|\| 'Agent'` in the tail. Trivial to extract, high signal-to-cost ratio. claude-hud already does this in 50 LOC. Needs Task-vs-Agent name handling. |
| **#24 last-tool hint** | D | **B** | Most recent `tool_use` block's `name` + `extractTarget()`. Essentially free once you are reading the transcript. This is a banner feature, not a cost. |
| **#87 failed-tool streak** | D | **B** | Walk `tool_result.is_error === true` backwards until you hit a success. One pass over the tail. Novel signal — nobody else ships this. |
| **#88 last-tool latency** | D | **B** (with caveats) | `tool_result.timestamp - tool_use.timestamp` for matched `tool_use_id`. The catch: in-flight tools have no `tool_result` yet. Show "running 3.2s" for those (claude-hud does). |
| **#38 cache-efficiency ratio** | B | **B** (unchanged, slight upgrade) | Accumulate `message.usage.{cache_read_input_tokens, cache_creation_input_tokens, input_tokens}` across assistant records. Must use latest-seen dedupe by `(message.id, requestId)` per ccusage#888. Handle both flat and nested `cache_creation` shapes. The bookmark makes this cheap; without it, cost rises with session length. |

**Net: 4 of 5 ideas move up one tier; #38 stays B but is easier to justify now that the architecture is clear.**

## The viability proof

### Cost model for the bookmark architecture

Per statusline invocation, on average:
- `fs.statSync(transcript_path)` — ~50 μs
- Compare `(mtime, size)` against bookmark — negligible
- If size unchanged: return cached reducer state — **~0 work**
- If size grew by N bytes: `fs.readSync` from `bookmark.offset` to `size` — ~20–100 μs for typical 1–10 new lines (a single assistant turn is ~500 bytes–5 KB)
- `JSON.parse` each new line — ~10–50 μs each, so ~100–500 μs for the burst
- Reduce into in-memory state (tools/agents/todos/tokens) — ~50 μs
- Serialize bookmark to disk: `writeFileSync` of a small (~10 KB max) state file — ~200–500 μs

Total hot-path cost: **~1–2 ms**, orders of magnitude under the 200ms budget. Node cold start (~30–50 ms) still dominates. A single-shot statusline is bounded by process startup + reading + rendering, with the transcript parse no longer a meaningful cost.

### Cost model for the claude-hud full-read architecture

Same invocation, same transcript, but full-read every time:
- `stat` + mtime/size check — same
- **Cache miss on every event** (because the event *is* the file growing)
- `createReadStream` + `readline` loop — ~5–10 ms per MB on Node
- `JSON.parse` every line — more significant
- Serialize full result — ~1 ms

For a 5 MB session: **~30–50 ms** transcript work — fine.
For a 20 MB session: **~120–200 ms** — consuming most of the budget.
For a 50 MB session: **~300–500 ms** — exceeds budget; stale statuslines and stacked executions.

Sessions routinely exceed 20 MB on multi-hour sprints per `claude-code#22365` evidence (session JSONL at 3.8 GB is the pathological upper bound).

### Why Rust gets away with naive

CCometixLine's same-shape read is ~10x faster because (a) `serde_json::from_str` on Rust-native strings is 3–5x faster than V8's JSON.parse, (b) Rust has no equivalent of V8 cold start, (c) `BufReader::lines()` allocates fewer intermediate strings. Rust can full-read a 50 MB transcript in <15 ms. Node can't. Hence the cache.

### The 200ms budget headroom

On a 5 MB transcript with the bookmark:
- Node startup: ~35 ms
- stdin JSON parse: ~1 ms
- Transcript bookmark read + reduce: ~2 ms
- Git (if execFile): ~15–30 ms (often the *real* bottleneck)
- Render + stdout: ~2 ms
- **Total: ~55–70 ms** — well under 200ms, well under 300ms.

On a 50 MB transcript with full-read:
- Node startup: ~35 ms
- stdin: ~1 ms
- Transcript full-read + reduce: ~300–500 ms
- Git: ~15–30 ms
- **Total: ~350–550 ms** — blown budget.

## Required engineering to ship

1. **Bookmark file** at `~/.claude/lean-statusline/bookmarks/<sha256(transcript_path)>.json`. Contents: `{ sessionId, lastOffset, lastSize, lastMtimeMs, reducerState }`.
2. **Invalidate on sessionId change** — if stdin's `session_id` differs from bookmark's, rebuild from scratch. This happens on `/clear`, session resume, or a new session.
3. **Tail read with EOF safety** — if `stat.size > bookmark.lastOffset`, read the range, split on `\n`, drop the trailing incomplete line (could be a partial flush), and advance offset only to the last complete `\n`.
4. **Reducer handles these block types** (from `../schema/01-transcript-jsonl-entry-types.md`): `tool_use` (tools/agents/todos), `tool_result` (status + endTime), `assistant.message.usage` (tokens with latest-seen dedupe per `(message.id, requestId)`).
5. **Cap in-memory state** — last N tools (20), last M agents (10), current todo list only. Otherwise long sessions bloat the bookmark file.
6. **Fallback to full-read** when the bookmark is corrupt/missing/sessionId-mismatched.
7. **Don't block on write** — do the bookmark write *after* stdout.end() if possible, so SIGINT doesn't truncate. Or accept that occasionally the bookmark is stale — worst case is one extra full-read.

## When transcript parsing is NOT worth it

- **For first release** when time-to-ship matters. Stdin has model, cwd, cost, duration, lines ±, context %, rate limits. That's already 80% of what a statusline displays.
- **For the "minimum" preset.** Keep the transcript parse gated behind opt-in flags, as claude-hud does. Users who want the minimal bar shouldn't pay for it.
- **For features that stdin will eventually expose.** `context_window.current_usage.input_tokens` already exists in 2.0.37+ stdin. Don't reimplement it from the transcript unless you need the per-turn breakdown.
- **If you can't afford the bookmark engineering yet.** Better to ship a fast full-read with a size cap (refuse to parse transcripts >5 MB; fall back to stdin-only) than to ship a slow full-read.

## Caveats / Negative Signal

- Byte-offset bookmarking has never been shipped in public code (see `../performance/02-caching-patterns-in-practice.md`). You're pioneering it. That means there is no existing bug pattern to copy; you will find your own edge cases.
- The bookmark depends on append-only semantics. If Claude Code ever introduces in-place transcript rewrites (unlikely given the design), bookmarks break. Invalidate on any `size` decrease.
- Schema drift is the long-tail tax. The flat-vs-nested `cache_creation` handling alone would silently under-count tokens on Opus 4.5+ if you only read the old shape. Copy CCometixLine's `RawUsage` approach: accept both shapes with serde-like `or`-chained field merging.
- The `exceeds_200k_tokens` boolean, `context_window.used_percentage`, and `rate_limits.*` fields are **much** more reliable than anything the transcript gives you. Lean on them first; use transcript as the augmentor, not the foundation.

## Sources

- `jarrodwatts/claude-hud` — `src/transcript.ts` — mtime+size cache pattern — fetched 2026-04-18
- `Haleclipse/CCometixLine` — `src/core/segments/context_window.rs`, `src/config/types.rs` — naive full-read + RawUsage flexible dedupe — fetched 2026-04-18
- `ryoppippi/ccusage#888` — latest-seen dedupe requirement — 2026-03-11
- `ryoppippi/ccusage#804` — scaled-up full-read cost — 2025-09
- `anthropics/claude-code#22365` — pathological session sizes — 2026-02-01
- `anthropics/claude-code#24463` — 300ms debounce contract — 2025-12
- `anthropics/claude-code#11535` — stdin payload fields — 2025-11-13
- Sid Bharath, "The Anatomy of Claude Code", 2026-03 — append-only transcript design
- `code.claude.com/docs/en/statusline` — slow-script behavior, refreshInterval minimum — fetched 2026-04-18
