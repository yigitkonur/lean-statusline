# How does claude-hud read and parse the Claude Code transcript JSONL?

**Scope:** The exact read strategy, caching pattern, and per-render work done by `jarrodwatts/claude-hud` (Node/TypeScript, 19.2k stars). Not covering rendering, git, or stdin-parsing.
**Last updated:** 2026-04-18
**Confidence:** High — direct source code reading of `src/transcript.ts` at `main`.

## Answer

claude-hud **full-reads the entire transcript file every time it parses**, but short-circuits with a disk cache keyed by `(mtimeMs, size)`. On an unchanged transcript between renders, it does a `stat()` + `readFileSync(cache.json)` + `JSON.parse(cache)` and returns — no JSONL re-scan. On a changed transcript, it re-streams the whole file line-by-line with `fs.createReadStream` + `readline`. There is **no tail-read, no offset bookmark, no incremental parse**.

## Evidence

### File: `src/transcript.ts` (main branch, fetched 2026-04-18)

**Cache key = path + mtime + size** (line 58–62, 89–91):

```ts
interface TranscriptCacheFile {
  transcriptPath: string;
  transcriptState: TranscriptFileState;   // { mtimeMs, size }
  data: SerializedTranscriptData;
}
function getTranscriptCachePath(transcriptPath: string, homeDir: string): string {
  const hash = createHash('sha256').update(path.resolve(transcriptPath)).digest('hex');
  return path.join(getHudPluginDir(homeDir), 'transcript-cache', `${hash}.json`);
}
```

**Hot path — if `mtimeMs` and `size` match, return cached result:**

```ts
// parseTranscript(), lines 191–199
const transcriptState = readTranscriptFileState(transcriptPath);   // fs.statSync
if (!transcriptState) return result;
const cached = readTranscriptCache(transcriptPath, transcriptState);
if (cached) return cached;
```

Cache validation check (lines 151–157) requires exact match of path, mtimeMs, AND size — any change forces full re-parse.

**Cold path — full file stream + line-by-line parse** (lines 217–245):

```ts
const fileStream = createReadStreamImpl(transcriptPath);
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  try {
    const entry = JSON.parse(line) as TranscriptLine;
    // …processEntry(entry, toolMap, agentMap, taskIdToIndex, latestTodos, result);
  } catch { /* skip malformed */ }
}
```

No seeking, no size cap, no early-exit. It reads from byte 0 to EOF every time the transcript's `mtime` or `size` changes — which happens on **every** assistant message since Claude Code appends to the same session JSONL.

**Cache write happens on clean parse** (lines 257–259):

```ts
if (parsedCleanly) {
  writeTranscriptCache(transcriptPath, transcriptState, result);
}
```

So the cache is a memoization of the parsed result — not a resumable parser state. When the file grows, the whole file is re-read; the cache only saves work when the statusline fires for a reason other than a new transcript entry (permission prompt, vim-mode toggle, refreshInterval tick).

### What it extracts (inferred contract — `processEntry`, lines 268–385)

From `message.content[]` blocks (on every `tool_use` / `tool_result`):
- `tool_use` with `block.name = 'Task' | 'Agent'` → **subagent** entry (`subagent_type`, `model`, `description`) stored in `agentMap` by tool_use id
- `tool_use` with `block.name = 'TodoWrite'` → replace `latestTodos` wholesale
- `tool_use` with `block.name = 'TaskCreate' / 'TaskUpdate'` → mutate `latestTodos`
- Any other `tool_use` → tool entry (name, target from input, startTime) into `toolMap`
- `tool_result` with `tool_use_id` → flip matching tool/agent to `completed` or `error` (`is_error`), set `endTime` (→ **last-tool-latency, failed-tool-streak derivable**)
- `entry.type === 'assistant'` → accumulate `message.usage.{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` into `sessionTokens` (→ **cache-efficiency ratio derivable**)

Result is trimmed to the last 20 tools and last 10 agents (lines 252–253).

### Runtime cadence — from `CLAUDE.md` (main):

> "The statusline is invoked every ~300ms by Claude Code. Each invocation: 1. Receives JSON via stdin… 2. Parses the transcript JSONL file for tools, agents, and todos…"

Confirmed in the `README.md`: *"Updates every ~300ms"*.

## Caveats / Negative Signal

- **No offset bookmark.** Every re-parse rescans from byte 0. A multi-hour session transcript at 20 MB means reading 20 MB of disk + 20 MB of JSON parsing per assistant message. The mtime-cache only helps when the file hasn't changed — it does not speed up the actual work that matters (new message → re-parse everything).
- **Cache serialization is JSON** (line 174: `fs.writeFileSync(cachePath, JSON.stringify(payload), 'utf8')`). On a long session, writing the cache itself becomes non-trivial.
- **Claude Code's own loader bug:** session JSONL files have been observed to grow to 3.8 GB and hang Claude Code itself ([claude-code#22365](https://github.com/anthropics/claude-code/issues/22365), 2026-02). Any full-read parser is at the mercy of that upper bound.
- **In-flight cancellation unclear.** Claude Code debounces at 300ms and cancels in-flight invocations on new events ([claude-code#24463](https://github.com/anthropics/claude-code/issues/24463)). If the async `for await` on the line stream is still running when the next invocation starts, Node exits and the cache write is skipped — `parsedCleanly` stays false.

## Sources

- `jarrodwatts/claude-hud` — `src/transcript.ts` @ main, lines 58–259 — fetched 2026-04-18 via raw.githubusercontent.com
- `jarrodwatts/claude-hud` — `CLAUDE.md` @ main — "statusline is invoked every ~300ms" — fetched 2026-04-18
- `jarrodwatts/claude-hud` — `README.md` @ main — "Updates every ~300ms" — fetched 2026-04-18
- `anthropics/claude-code#24463` — "statusline command script only runs on specific events (assistant messages, permission changes, vim mode toggles), debounced at 300ms" — fetched 2026-04-18
