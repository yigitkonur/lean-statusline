# What caching patterns actually survive the 300ms budget?

**Scope:** The three caching patterns shipped by real Claude Code statuslines, and the one pattern nobody ships.
**Last updated:** 2026-04-18
**Confidence:** High — direct source-code comparison across 3 projects plus the Claude Code docs' own guidance.

## Answer

Three patterns are in active use:
1. **mtime+size result cache** (claude-hud) — cache the parsed output, keyed by `(mtimeMs, size)`; rescan the whole file when either changes.
2. **TTL cache of derived fields** (ccusage-statusline, cc-statusline examples) — cache expensive values for N seconds on disk; refresh on expiry or explicit event.
3. **No cache, native speed** (CCometixLine) — Rust serde_json is fast enough that brute force works.

**The pattern nobody ships** is the one that would be optimal for Node: **byte-offset bookmarking with append-only tail read** (`fs.read` at the previous EOF offset, parse only new lines, merge into in-memory state). Transcripts are append-only by Claude Code design — this would turn a 20 MB session into a ~2 KB incremental read per event. Nobody has it in public code as of 2026-04.

## Evidence

### Pattern 1: mtime+size result cache — claude-hud

`jarrodwatts/claude-hud` `src/transcript.ts` (main, fetched 2026-04-18), lines 146–178:

```ts
function readTranscriptCache(transcriptPath: string, state: TranscriptFileState): TranscriptData | null {
  const cachePath = getTranscriptCachePath(transcriptPath, os.homedir());
  const raw = fs.readFileSync(cachePath, 'utf8');
  const parsed = JSON.parse(raw) as TranscriptCacheFile;
  if (
    parsed.transcriptPath !== path.resolve(transcriptPath)
    || parsed.transcriptState?.mtimeMs !== state.mtimeMs
    || parsed.transcriptState?.size !== state.size
  ) {
    return null;
  }
  return deserializeTranscriptData(parsed.data);
}
```

Cache lives at `~/.claude/plugins/claude-hud/transcript-cache/<sha256(path)>.json`. Payload is the serialized `TranscriptData` (tools, agents, todos, sessionTokens). Invalidation happens on any change to the JSONL.

**Hit rate in practice:** this caches only non-event re-runs (refreshInterval ticks, permission prompts, vim toggles). On the actual "new assistant message" path, every invocation is a cache miss because the transcript grew. The cache is a safety net for spurious invocations, not a speed win on the hot path.

### Pattern 2: TTL cache of derived fields

Claude Code's own docs suggest this pattern in the statusline page:

```bash
# from code.claude.com/docs/en/statusline, "Cache expensive operations"
cached_data=$(get_cached_data <cache_file> <max_age> <fetch_command>)
```

CCometixLine's `UsageSegment` (src/core/segments/usage.rs, lines 98–106) uses it for the Anthropic API call:

```rust
fn is_cache_valid(&self, cache: &ApiUsageCache, cache_duration: u64) -> bool {
    // default 300 seconds
    elapsed.num_seconds() < cache_duration as i64
}
```

This is the right pattern for *external* calls (API, npm version lookup, slow git), not for transcript parsing — the transcript is local and fast to stat.

### Pattern 3: No cache — CCometixLine transcript

Already covered in `../parsers/02-ccometixline-read-strategy.md`. Rust + serde_json make brute force viable.

### The missing pattern: byte-offset bookmark

What would this look like? Something like:

```ts
// pseudo-code — NOT implemented in any public statusline
interface BookmarkedState {
  path: string;
  sessionId: string;      // invalidate if session changes
  lastOffset: number;     // byte offset, append-only means this only grows
  parsed: {               // reducer output
    tools: ToolEntry[];
    agents: AgentEntry[];
    todos: TodoItem[];
    sessionTokens: SessionTokenUsage;
  };
}

// hot path:
const stat = fs.statSync(transcriptPath);
if (stat.size === state.lastOffset) return state.parsed;           // 0 bytes new
const buf = await readRange(transcriptPath, state.lastOffset, stat.size);
const newLines = buf.split('\n').filter(Boolean);
for (const line of newLines) reduce(JSON.parse(line), state.parsed);
state.lastOffset = stat.size;
writeBookmark(state);
return state.parsed;
```

Why nobody ships it:
- Requires handling the edge case where the session changes (new transcript_path) — invalidate by `sessionId`.
- Requires handling mid-line truncation if Claude Code flushes a partial write (rare; JSONL is line-atomic, but stat.size may beat the flush).
- Everyone started with "read the whole file" and added a result-cache instead of refactoring to a reducer.

The Claude Code source ([sidbharath.com 2026-03](https://sidbharath.com/blog/the-anatomy-of-claude-code/)) confirms the file is append-only — the design constraint that enables this optimization.

### Reddit validation of the "read the files" realization

`u/rz1989s`, r/ClaudeAI, +51 upvotes, 2026-01 ([post](https://www.reddit.com/r/ClaudeAI/comments/1pyj6ax/)):

> "basically we used to bug ccusage for all our data. great tool no hate. but then someone (me) finally looked at `~/.claude/projects/` and realized claude just... saves everything in json files??? … we literally spent months going 'how do we get this data' when claude was writing it to disk the whole time. skill issue tbh"

Supporting comment from `u/Delicious-Storm-5243` (+2):

> "don't just read individual session jsonls, aggregate them. I have a script that reads all jsonls in my Claude state dir, parses them into one DataFrame… Mine live in `~/.claude/projects/{hash}/*.jsonl` which makes the per-project aggregation clean."

Everyone full-reads. Nobody bookmarks.

## Caveats / Negative Signal

- Byte-offset bookmarking won't help for cross-session aggregates (cost across 30 days, etc.) — that needs ccusage-style full reads across multiple files. For a per-session statusline it is nearly optimal.
- On Windows, filesystem mtime precision is coarser (often 2-second granularity on FAT, 100ns on NTFS). The mtime+size cache is more robust than mtime alone because of this.
- If Claude Code introduces transcript compaction / rewrites of an existing JSONL file, an offset bookmark breaks. Current design is pure append-only per the databunny.medium.com article and the Claude Code anatomy post — stable for now.
- Node's `fs.read()` with a byte range is straightforward; there's no platform wart to worry about. The effort to ship this is small; the reason nobody has is inertia.

## Sources

- `jarrodwatts/claude-hud` — `src/transcript.ts` — cache implementation — fetched 2026-04-18
- `Haleclipse/CCometixLine` — `src/core/segments/usage.rs` — TTL cache — fetched 2026-04-18
- `code.claude.com/docs/en/statusline` — "Cache expensive operations" section — fetched 2026-04-18
- `u/rz1989s`, r/ClaudeAI, +51, 2026-01 — ["finally read the transcript files"](https://www.reddit.com/r/ClaudeAI/comments/1pyj6ax/)
- Sid Bharath, ["The Anatomy of Claude Code"](https://sidbharath.com/blog/the-anatomy-of-claude-code/) — 2026-03 — append-only design
