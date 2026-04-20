# Transcript bookmark reducer

**Tier:** S | **Composite:** 9.60 | **Original ID:** N6 (new from research) | **Depends on:** session-state-file | **Blocks:** native-subagent-count (for fallback), last-tool-hint, failed-tool-streak, tool-latency, cache-efficiency enhancements

## 1. What it is

An append-only JSONL reader that streams only the **new bytes** written to `input.transcript_path` since last render, keyed by `(session_id, lastByteOffset, reducerState)` in the session-state file. The reducer maintains a tiny derived model — last tool used, failure streak, active subagent names, cache-read vs cache-creation ratio — without ever re-reading bytes it's already seen. Hot-path cost: **1–2 ms regardless of transcript size**.

Nobody in the ecosystem ships this. claude-hud full-reads the whole file every event. CCometixLine also full-reads but gets away with it because Rust + serde_json are ~10× faster than Node. This is the design Node needs.

## 2. Showcase

```
                Transcript bookmark reducer
┌──────────────────────────────────────────────────────────────────┐
│  /path/to/transcript.jsonl  (5.2 MB, appends on every tool call)  │
│                                                                    │
│   ╔═══════════════════════════════════════════════════════════╗   │
│   ║  bytes 0                   lastOffset=5_242_880     EOF   ║   │
│   ║  ──────────────────────────────────│────────────────→     ║   │
│   ║      (already parsed — skip)        │  (new delta only)    ║   │
│   ║                                     └─ read from here     ║   │
│   ╚═══════════════════════════════════════════════════════════╝   │
│                                                                    │
│   delta parse → [                                                  │
│     { type: "tool_use", name: "Edit", id: "t_42" },               │
│     { type: "tool_result", tool_use_id: "t_42", is_error: false } │
│   ]                                                                │
│                                                                    │
│   reducer state ← merge:                                           │
│     lastTool: "Edit"                                               │
│     lastToolOk: true                                               │
│     failStreak: 0  (reset)                                         │
│     subagents: {}  (no Task block)                                 │
│                                                                    │
│   saveState(session_id, { ...state, transcriptOffset: <new EOF> })│
└──────────────────────────────────────────────────────────────────┘
```

## 3. Why we need it

- **Transcript parsing unlocks 4 otherwise-impossible ideas** (#23 native-backup, #24, #87, #88). Agent 1 confirmed these are genuine differentiators — nobody ships them.
- **Naive full-reads aren't viable in Node** at the 200 ms render budget. Agent 1 measured claude-hud doing multi-MB full-reads per event.
- **Append-only JSONL is a gift.** Claude Code never rewrites the transcript from the middle — validated in databunny.medium.com's session-format analysis and sidbharath.com's anatomy. Byte offsets are stable.
- **The reducer model is exactly the right shape.** The questions users care about ("what tool is running?", "is it failing?", "how many subagents?") need tiny state, not the full transcript.

## 4. Ecosystem examples

- **claude-hud** (`readTranscript` function): full `createReadStream + readline`, parsed every event. Cache keyed on `(mtimeMs, size)` — which changes every event, so cache is effectively a no-op. Evidence: `docs/research/transcript-statuslines/claude-hud/02-full-read-with-noop-cache.md`.
- **CCometixLine** (`transcript.rs`): same full-read + parse, no caching. Rust saves it. Evidence: `docs/research/transcript-statuslines/ccometixline/01-brute-force-rust.md`.
- **ccusage** at one point had the same pattern project-wide and hit a 300% CPU regression (issue #804) — proof that the naive approach fails at scale.
- **Nobody** runs incremental-reduce. That's both the risk (novel) and the opportunity (differentiator).

## 5. Position on the line

Not a segment. A derivation layer consumed by `native-subagent-count`, `last-tool-hint`, `failed-tool-streak`, `tool-latency`, `cache-efficiency`. Gated behind the `full` preset so `compact`/`minimal` users pay zero cost.

## 6. How users use it

Users don't invoke this directly. Segments that consume reducer state declare it as a data source. Users only see the features that depend on it.

Opt-in kill switch:

```bash
LEAN_STATUSLINE_NO_TRANSCRIPT=1 claude   # disables all transcript-derived segments
lean-statusline config --set transcript.enabled=false
```

## 7. Default mode

- `minimal`, `compact`: **off**. No transcript I/O.
- `full`: **on**. Required for subagent count, tool status, fail streak.
- Respects kill switch globally.

## 8. Visualization

Not applicable (derivation layer). The features consuming it handle their own rendering.

## 9. Data source

- `input.transcript_path` (always present per docs).
- Byte offset + reducer state persisted in `session-state-file` under key `transcript`.

## 10. Doability

**Solved by design, not magic.** Append-only guarantee is the key. Agent 1's evidence:

- `transcript_path` is stable for a session (verified by reading source).
- Entries are valid JSON one per line, terminated with `\n`.
- No entry-rewrite observed in any Claude Code version 2.0.x–2.1.109.
- `fs.createReadStream(path, { start: lastOffset })` works reliably on macOS, Linux, and Windows (NTFS handles offset-read fine).

Edge cases covered:

- **Rotation / compaction** — rare but happens (user runs `/clear` or Claude Code compacts). Detected via `fs.statSync(path).size < lastOffset`. Response: reset offset to 0, rebuild reducer state from scratch. Cost: one full-read on that event only.
- **Partial line at EOF** (Claude Code flushing mid-line): detect via last byte ≠ `\n`, back offset up to last complete line.

## 11. Performance budget

- **Warm path** (delta = 0 or 1 new lines): **<2 ms**.
- **Rotation / first-read**: one full read, budgeted at 50 ms for a 5 MB transcript (stream + parse, no memorize).
- **Write** (save new offset): part of existing state-file write (no extra I/O).

Cache hit rate: near 100% after first few renders per session.

## 12. Reliability & failure modes

- **Transcript path missing** (pre-first-API-call in some builds): no-op, reducer stays empty. All consumers gracefully render nothing.
- **Malformed JSON line** (extremely rare): skip that line with debug log, continue. Don't crash.
- **File deleted between renders** (user moved `.claude/`): rotation branch handles it.
- **Race: Claude Code writing while we're reading** — `createReadStream` sees a snapshot per node's fd semantics. We cap read at `stat.size` at open time to avoid torn reads.
- **Transcript huge (>100 MB)** — happens on long sessions. Warm path is unaffected (offset-based). First-read budgeted up to 500 ms; acceptable since it's one-time per session.

## 13. Config schema

```json
{
  "transcript": {
    "enabled": true,
    "maxFirstReadMs": 500,
    "reducers": ["lastTool", "failStreak", "subagents", "cacheRatio"]
  }
}
```

Default `enabled` varies by preset (false for minimal/compact, true for full). User can explicitly override.

## 14. Code integration

**New file:** `lib/transcript.mjs` (~200 LOC)

```js
import { createReadStream, statSync } from 'node:fs';
import { createInterface } from 'node:readline';

export async function reduceTranscript(path, prevOffset, prevReducerState, maxMs = 500) {
  if (!path) return { offset: 0, state: emptyReducer() };
  let stat;
  try { stat = statSync(path); } catch { return { offset: 0, state: emptyReducer() }; }

  // Rotation detection — file got smaller.
  const startOffset = (stat.size < prevOffset) ? 0 : prevOffset;
  const state = (startOffset === 0) ? emptyReducer() : { ...prevReducerState };

  // Short-circuit: nothing new.
  if (startOffset === stat.size) return { offset: stat.size, state };

  const deadline = Date.now() + maxMs;
  const stream = createReadStream(path, { start: startOffset, end: stat.size - 1 });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let byteCursor = startOffset;
  for await (const line of rl) {
    if (Date.now() > deadline) break;  // time-budget guard
    byteCursor += Buffer.byteLength(line, 'utf8') + 1;  // +1 for \n
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      applyToReducer(state, entry);
    } catch { /* malformed line — skip */ }
  }
  return { offset: byteCursor, state };
}

function emptyReducer() {
  return { lastTool: null, lastToolOk: null, failStreak: 0, subagents: {}, cacheStats: null };
}

function applyToReducer(state, entry) {
  // Handle entry.type ∈ {user, assistant, system}, with nested content[] of
  // {tool_use, tool_result, text}. Schema details documented in
  // docs/research/transcript-statuslines/02-schema/.
  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_use') {
        state.lastTool = block.name;
        if (block.name === 'Task' || block.name === 'Agent') {
          state.subagents[block.id] = { name: block.input?.subagent_type ?? 'unknown', started: Date.now() };
        }
      }
    }
  }
  if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_result') {
        state.lastToolOk = !block.is_error;
        state.failStreak = block.is_error ? state.failStreak + 1 : 0;
        if (state.subagents[block.tool_use_id]) delete state.subagents[block.tool_use_id];
      }
    }
  }
  // Cache stats — use ccusage's latest-seen-dedup on (message.id, requestId)
  // + handle flat vs nested cache_creation.
  const usage = entry.message?.usage;
  if (usage) {
    state.cacheStats = {
      cacheRead: usage.cache_read_input_tokens ?? 0,
      cacheCreation: (usage.cache_creation_input_tokens
                   ?? usage.cache_creation?.ephemeral_5m_input_tokens
                   ?? 0) + (usage.cache_creation?.ephemeral_1h_input_tokens ?? 0),
      input: usage.input_tokens ?? 0,
    };
  }
}
```

**Integrate in `bin/lean-statusline.mjs`** after state load:

```js
import { reduceTranscript } from '../lib/transcript.mjs';

// ...
const prev = state.lastSeen.transcript ?? { offset: 0, state: {} };
const { offset, state: reducer } = cfg.transcript?.enabled
  ? await reduceTranscript(input.transcript_path, prev.offset, prev.state, cfg.transcript?.maxFirstReadMs)
  : { offset: prev.offset, state: prev.state };
state.lastSeen.transcript = { offset, state: reducer };

const ctx = { ..., transcript: reducer };
```

## 15. Dependencies

- `session-state-file` (for offset persistence).
- `defensive-payload-probing` (for `input.transcript_path` presence check).

## 16. Testing

- **Unit** (`test/transcript.test.mjs`):
  - Fresh transcript → full reducer state.
  - Second call with same mtime → offset unchanged, no re-parse.
  - Append 3 new lines → delta read produces correct incremental state.
  - Rotation (file shrinks) → offset resets to 0.
  - Malformed line → skipped, reducer still valid.
  - Huge transcript (10 MB test fixture) — first-read completes under 500 ms on CI runner.
- **Schema fixtures** under `test/fixtures/transcripts/`: one per Claude Code minor version.
- **Integration**: 5 renders in sequence, assert offset strictly increases and reducer converges to expected state.

## 17. Rollout plan

- Ship in `lean-statusline@1.3.0` behind `cfg.transcript.enabled` (default false for compact, true for full).
- Release notes call out the 500 ms first-read budget and how to disable.
- Next minor makes it default-on for compact once stability is proven.

## 18. Regression risks

- **Schema drift**: a new transcript entry type appearing could be ignored silently. Not a regression — reducer just doesn't see new data. Mitigation: probe telemetry (in defensive-probing) can log "unknown entry type observed: X" once per session.
- **Time-budget breach on first read**: mitigated by hard deadline + partial reducer state. Next render picks up where we stopped.
- **Corrupt offset in state file** (extremely rare): triggers rotation branch, full re-read on next render, self-heals.

## 19. Success metrics

- 95th-percentile warm-path parse time <5 ms over 100 renders.
- Zero transcript-related crashes in 1000-session corpus.
- First-read cold path under 500 ms for 99% of sessions (5 MB transcript).
- Three dependent segments (subagent-count, last-tool, fail-streak) ship concurrently with working end-to-end demos.

## 20. Open questions

- Should the reducer state be bounded (e.g., keep only last 20 tool_use blocks)? Yes — add LRU eviction to `applyToReducer` for anything list-shaped.
- Does Windows NTFS handle `createReadStream({ start })` identically to POSIX? Agent 1 cited evidence yes, but we should have a CI runner for it.
- Should we mmap for enormous transcripts? Not worth it — 500 ms one-time cost is acceptable and mmap adds a native dependency.
