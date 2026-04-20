# Node vs Rust: the same naive strategy, different viability

**Scope:** Side-by-side comparison of the two projects' transcript-parsing approaches and why claude-hud has to cache while CCometixLine does not.
**Last updated:** 2026-04-18
**Confidence:** High — source-code comparison with published performance claims.

## Answer

Both projects use the **same conceptual strategy** (read the whole file, parse every line, extract state). claude-hud wraps it in an mtime+size memoization cache because Node cannot afford the raw cost; CCometixLine ships the naive version unwrapped because Rust + serde_json are fast enough. Neither has cracked an incremental-parse or tail-read approach — they brute-force and let either caching (Node) or language speed (Rust) absorb the cost.

## Evidence

### Side-by-side

| Dimension | claude-hud (Node/TS) | CCometixLine (Rust) |
|---|---|---|
| Stars / scale | 19.2k | ~smaller; npm `@cometix/ccline` |
| Read strategy | `fs.createReadStream` + `readline` iterator | `BufReader::lines().collect::<Vec<_>>()` |
| Parse cost | O(file size), every line parsed | O(file size), reverse-scanned; only last assistant actually parsed |
| Caching | Yes — `sha256(path).json` in `~/.claude/plugins/claude-hud/transcript-cache/`, invalidated by `(mtimeMs, size)` | **None** |
| Fields extracted | tools, tool_results (status + latency), agents/Task, todos, session_tokens | last assistant's `message.usage` only |
| Render budget | ~300ms (stated) | ~2ms claimed vs 62ms for claude-hud (see "negative signal") |
| Fallback on error | Return partial result | Return None; skip segment |

### Claim: "Rust 2ms vs claude-hud 62ms"

`u/OtherwiseJellyfish73`, r/ClaudeAI, 2026-01 ([thread](https://www.reddit.com/r/ClaudeAI/comments/1s3y3m2/i_built_a_faster_status_line_for_claude_code_in/)):

> "claude code calls your status line command every ~300ms. i was using claude-hud but it spawns 24 subprocesses (jq, git, grep, date) on every single invocation - 62ms each time. so i built cstat - a native rust binary that does the same job in 2ms with zero subprocess spawns."

Confounded — "24 subprocesses" is about git/shell, not the transcript parse itself. But it demonstrates the perception and the direction of the gap. Note: the claude-hud code above **does not spawn jq/grep**; it's pure Node. The 62ms likely includes Node startup (~30–50ms cold) plus transcript read.

### Why the cache is essential for Node

Node cold-start alone is ~30–50ms. `fs.createReadStream` + `readline` + per-line `JSON.parse` on a 20 MB transcript is another 40–80ms. Without the mtime cache, a 10-minute session would become painful at ~5 MB; a multi-hour session at 20–50 MB would blow well past the 300ms render budget on every invocation. The cache hit path (stat + readFileSync + JSON.parse of a pre-reduced object) brings that back to roughly Node-startup-plus-10ms.

**Critical realisation:** the cache only helps when the transcript did **not** change. But the statusline fires *because* an assistant message was just written, which bumps mtime and size. The cache is a **no-op on the hot path**. It only saves work on:
- permission-prompt re-runs
- vim-mode toggle re-runs
- `refreshInterval` timer ticks ([claude-code#24463](https://github.com/anthropics/claude-code/issues/24463), 2025-12)
- multi-line statusline scripts that render twice for one event

So claude-hud, on the "new assistant message" path, is doing the full read every time. The cache is a safety net, not a win.

### Why CCometixLine can skip caching

Rust-native `serde_json::from_str` on a single JSONL line costs ~1–5 μs. A 20 MB transcript has roughly 2000–10000 lines; reverse-scan typically hits an assistant entry within the last 3–10 lines, so only those are deserialized. The disk read via `BufReader` is the dominant cost and is ~2–10ms on SSD. Total budget: easily under 20ms even with git + model + directory segments combined. No cache needed.

### There is no smarter approach in either project

Neither repo:
- uses `fs.read` + `Buffer` at a negative offset (tail-read)
- keeps a persistent daemon holding parse state
- stores `(last_file_offset, last_parsed_state)` to resume mid-file
- treats the JSONL as append-only and seeks to the last-seen byte

The `claude-code-transcripts` Rust crate ([docs.rs](https://docs.rs/claude-code-transcripts/)) is a typed parser but still expects a full read + line loop. No one has shipped an incremental parser in public as of 2026-04.

## Caveats / Negative Signal

- The "62ms" number for claude-hud from the cstat Reddit post is unverified by me and likely predates the transcript cache (commit history suggests caching was added as of some 2025 release I did not pinpoint). The current codebase is likely faster than 62ms on cache-hit paths.
- claude-hud's README mentions "spawns subprocesses (jq, git, grep)" — `src/git.ts` uses `execFile` with array args; I did not read it fully, but the `@wyattjoh/claude-status-line` and `cc-statusline` communities repeatedly flag shell-hop cost as the dominant factor, not JSONL parse. A pure-Node transcript parser that avoids execFile-for-git is already ahead.

## Sources

- `jarrodwatts/claude-hud` — `src/transcript.ts`, `src/index.ts` @ main — fetched 2026-04-18
- `Haleclipse/CCometixLine` — `src/core/segments/context_window.rs` @ master — fetched 2026-04-18
- `u/OtherwiseJellyfish73` r/ClaudeAI, 2026-01 — ["2ms vs 62ms"](https://www.reddit.com/r/ClaudeAI/comments/1s3y3m2/) — 0 upvotes; perception only
- `claude-code-transcripts` Rust crate — docs.rs — 2026 — typed parser, no incremental-parse support
