# Transcript-Based Statuslines — Research Summary

**Topic:** Evaluate whether transcript JSONL parsing is viable for a Node-based Claude Code statusline with a 200 ms render budget, grounded in how `jarrodwatts/claude-hud` and `Haleclipse/CCometixLine` actually do it.
**Last updated:** 2026-04-18
**Coverage scope:** Source-code reading for both repos at head; official Claude Code statusline docs; 7 GitHub issues; 5 Reddit posts with comment threads; 1 HN thread; 4 blog posts. Out of scope: render layout, git parsing, subagent-transcript (`agent-*.jsonl`) deep-dive beyond detection — none of the surveyed statuslines open the sidechain files.

## Document index

| File | What it answers |
|---|---|
| [parsers/01-claude-hud-read-strategy.md](parsers/01-claude-hud-read-strategy.md) | Exact Node/TS parser — full-read with mtime+size result cache |
| [parsers/02-ccometixline-read-strategy.md](parsers/02-ccometixline-read-strategy.md) | Exact Rust parser — naive full-read, no cache, just last-assistant scan |
| [parsers/03-strategy-comparison-node-vs-rust.md](parsers/03-strategy-comparison-node-vs-rust.md) | Why the same pattern needs a cache in Node and runs raw in Rust |
| [schema/01-transcript-jsonl-entry-types.md](schema/01-transcript-jsonl-entry-types.md) | The 7 record types, 3 content block types, subagent sidechain convention |
| [schema/02-stdin-fields-vs-transcript-fields.md](schema/02-stdin-fields-vs-transcript-fields.md) | Split: what's free from stdin vs what requires parsing |
| [performance/01-render-budget-and-debounce.md](performance/01-render-budget-and-debounce.md) | 300ms debounce, event-driven invocation, no kill timeout, in-flight cancellation |
| [performance/02-caching-patterns-in-practice.md](performance/02-caching-patterns-in-practice.md) | Three real patterns + the one (offset bookmark) nobody ships |
| [community/01-user-complaints-and-edge-cases.md](community/01-user-complaints-and-edge-cases.md) | 8 concrete complaints from GH issues / Reddit / HN |
| [verdict/01-viability-for-node-200ms-budget.md](verdict/01-viability-for-node-200ms-budget.md) | Final verdict + reweighted feature tiers |

## Critical findings

1. **claude-hud's architecture is not the sophisticated thing you'd guess from a 19.2k-star repo.** It is a full-file `createReadStream + readline` loop on every cache miss, with a disk-backed memoization cache keyed by `(mtimeMs, size)`. On the "new assistant message just arrived" hot path — which is the only event a statusline truly cares about — **the cache is always a miss**. The cache only helps non-event re-runs (permission prompts, refreshInterval ticks). See [parsers/01](parsers/01-claude-hud-read-strategy.md).

2. **CCometixLine does transcript parsing in 50 lines of Rust, no cache.** It reads the whole file into `Vec<String>`, scans backward for the last `assistant` message, extracts `message.usage`, done. No tools, no agents, no todos — it answers exactly one question (current context token count). Rust + serde_json make brute force affordable; Node cannot get away with this. See [parsers/02](parsers/02-ccometixline-read-strategy.md).

3. **The append-only design invites an offset-bookmark architecture that nobody has shipped publicly.** Transcripts are strictly append-only (confirmed by Sid Bharath's Claude Code internals analysis and the databunny.medium.com session format article). Bookmark the last byte offset, read only the delta, merge into an in-memory reducer — total hot-path cost is ~1–2 ms regardless of session size. This is the architectural gap. See [performance/02](performance/02-caching-patterns-in-practice.md) and [verdict/01](verdict/01-viability-for-node-200ms-budget.md).

4. **The schema is mostly stable, but two drifts matter:** (a) `cache_creation_input_tokens` flat vs `cache_creation.ephemeral_5m_input_tokens` nested — claude-hud reads only the flat form and silently zeros Opus 4.5+ cache writes; (b) intermediate `(message.id, requestId)` duplicates require **latest-seen** dedupe not first-seen — ccusage#888 documents 80% undercount when this is wrong. See [schema/01](schema/01-transcript-jsonl-entry-types.md).

5. **For lean-statusline's feature list, 4 of 5 transcript-dependent ideas move from D to B tier** with a proper bookmark architecture. #24 last-tool hint and #87 failed-tool streak are essentially free bonuses once you're parsing at all. #38 cache-efficiency ratio is the most schema-sensitive and requires latest-seen dedupe — but it's viable. See [verdict/01](verdict/01-viability-for-node-200ms-budget.md).

## Cross-file insights

- **The 300ms debounce is not a parse budget — it's a *presentation* budget.** Claude Code does not kill slow scripts; it just shows stale data. Stacked invocations from rapid events are the real failure mode. This makes "correct-but-slow" worse than "approximate-but-fast". (Seen across performance/01 + community/01.)

- **Both top projects bottleneck on the same thing: Node cold start, not JSONL parse.** ccusage #804's 300% CPU comes from scanning many files, not from any single file being big. claude-hud's perceived "62ms" is Node startup + subprocess spawning + parse. The parse itself is small. Beating these projects on the transcript axis is not where the UX win lives — but *not being worse* on it is table stakes.

- **Nobody uses the `toolUseResult.agentId` → subagent sidechain file path.** LangChain documented it for tracing; no statusline opens the sibling `agent-*.jsonl`. That means "live subagent token burn" is an untapped differentiator — cheap to add with a bookmark per subagent, impossible to add with claude-hud's main-file-only scanner.

- **Claude Code's stdin is getting richer faster than the transcript parsers are getting smarter.** `context_window.*` and `rate_limits.*` were added to stdin in 2.0.x+; these eliminated most of the reason to parse for token data. Parsing is now a differentiator for specific signals (per-turn, per-tool, per-subagent, cache hit ratio, todo state) — not the baseline.

## Action items — ranked for lean-statusline

1. **Ship stdin-only first.** Model, cwd, cost, duration, lines ±, context %, rate limits are free. A statusline that does only this is ~50 ms end-to-end and satisfies 80% of users.

2. **Add a bookmark-based transcript reducer as the `transcript` module.** Persist at `~/.claude/lean-statusline/bookmarks/<sha256(path)>.json` with `{sessionId, lastOffset, reducerState}`. Invalidate on session_id change or size shrink. This is 150–250 LOC and unlocks all the transcript features at <2ms hot-path cost.

3. **Reducer surface (minimum):** last N=20 tool entries (name, target, status, startTime/endTime, is_error), last M=10 agent entries (type, model, description, status), current todo list (from last TodoWrite), running `sessionTokens` with latest-seen dedupe. This matches claude-hud's output but gets it at a fraction of the cost.

4. **Feature-gate the transcript module.** Default preset: stdin only. "Full" preset: stdin + transcript. This is the claude-hud/Anthropic-docs pattern and the right UX default.

5. **Copy CCometixLine's `RawUsage` flexible deserialization** for token fields — accept both flat and nested `cache_creation`, fall back across Anthropic↔OpenAI field names, use serde-like "first non-null wins" across synonymous keys. This buys you resilience against the next schema drift with zero cost at runtime.

6. **Don't scan project-wide.** ccusage's 300% CPU is because of cross-session scans. The statusline only cares about the current `transcript_path`. Resist the urge to aggregate; leave that to a separate offline tool.

7. **Ship a 5 MB size guard.** If the transcript is >5 MB and the bookmark is missing, fall back to stdin-only with a log line. Don't cold-start a 50 MB parse.

## Source roll-up

- **Source code (direct reads):** 2 repos × 4 files = claude-hud `transcript.ts + types.ts + index.ts + CLAUDE.md`, CCometixLine `context_window.rs + usage.rs + types.rs`
- **Official docs:** Claude Code statusline page, agent-sdk/sessions page, claude-code-transcripts Rust crate docs
- **GitHub issues (named, dated, quoted):** 7 — claude-code #11535, #16578, #22365, #24463; ccusage #804, #888; CCometixLine #96, #107; claude-agent-sdk-typescript #287
- **Reddit threads (named users, upvotes, dated):** 5 — r/ClaudeAI 1s3y3m2, 1pyj6ax, 1mpwto9; r/ClaudeCode 1pjbriy, 1se8fc9
- **HN:** 1 — item 46546937 (Contextify author on subagent sidechains)
- **Blogs / long-form:** 4 — databunny.medium.com (session format), sidbharath.com (anatomy), pub.towardsai.net (claude-hud), emelia.io (claude-hud review)
- **Langchain tracing plan:** `langchain-ai/tracing-claude-code/subagent-plan.md`

## Explicit gaps

- Did not read `src/stdin.ts` or `src/git.ts` from claude-hud; the "24 subprocesses" claim in the Reddit post was not verified in current code (may predate cache + refactor).
- Did not measure actual Node cold-start + full-read time on lean-statusline's target hardware; the 200ms budget analysis is based on generally-observed Node numbers.
- Did not catalog the complete variant set of Claude Code transcript records across 2.0.x → 2.1.x — the `claude-code-transcripts` Rust crate was identified as the canonical source but not its per-variant fields.
- Did not verify the `refreshInterval` minimum is 1 second in current Claude Code binaries — that's from the docs, which lag behind.
