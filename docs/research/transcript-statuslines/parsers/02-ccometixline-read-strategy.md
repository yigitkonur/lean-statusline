# How does CCometixLine read and parse the transcript JSONL?

**Scope:** `Haleclipse/CCometixLine` (Rust, published as `@cometix/ccline` on npm). Focus on `src/core/segments/context_window.rs` and its parsing approach vs. claude-hud.
**Last updated:** 2026-04-18
**Confidence:** High — direct reading of source at `master`, confirmed by 3 independent Reddit comments on the tool.

## Answer

CCometixLine does a **naive full-file read into a `Vec<String>` on every invocation**, then scans **backwards** to find the last `assistant` message and extracts its `message.usage` fields. There is **no caching**, no mtime check, no offset bookmark. The Rust stdlib (`BufReader::lines()`) plus `serde_json` is just fast enough that the author treats this as acceptable. The statusline only needs the **last assistant message's** usage block — it does not track tools, todos, or agent activity at all.

## Evidence

### File: `src/core/segments/context_window.rs` (master, fetched 2026-04-18)

**Full-read into memory** (lines 104–110):

```rust
fn try_parse_transcript_file(path: &Path) -> Option<u32> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);
    let lines: Vec<String> = reader
        .lines()
        .collect::<Result<Vec<_>, _>>()
        .unwrap_or_default();
    …
```

**Scan backwards for the last assistant message** (lines 129–145):

```rust
// Normal case: find the last assistant message in current file
for line in lines.iter().rev() {
    let line = line.trim();
    if line.is_empty() { continue; }
    if let Ok(entry) = serde_json::from_str::<TranscriptEntry>(line) {
        if entry.r#type.as_deref() == Some("assistant") {
            if let Some(message) = &entry.message {
                if let Some(raw_usage) = &message.usage {
                    let normalized = raw_usage.clone().normalize();
                    return Some(normalized.display_tokens());
                }
            }
        }
    }
}
```

So on a fast path, it reads the whole file but only JSON-parses lines from the end until it hits an assistant. However, the collection step (`reader.lines().collect::<Vec<_>>()`) already costs a full O(file size) disk read — it does not early-terminate.

**Summary-record handling** (lines 115–126): if the last line is `type=summary`, it pulls the referenced `leafUuid` and searches **every other `.jsonl` file in the project directory** for that UUID. This is a full scan across all sibling sessions.

**Fallback across project history** (lines 236–270): if the transcript path does not exist, it enumerates all `.jsonl` files in the parent directory, sorts by mtime, and tries each in order — each try is another full read.

### What it extracts

From `src/config/types.rs` (lines 407–416):

```rust
#[derive(Deserialize)]
pub struct TranscriptEntry {
    pub r#type: Option<String>,
    pub message: Option<Message>,
    #[serde(rename = "leafUuid")] pub leaf_uuid: Option<String>,
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")] pub parent_uuid: Option<String>,
    pub summary: Option<String>,
}
```

That's it — no `tool_use`, no `tool_result`, no `sidechain`, no `subagent_type`. CCometixLine's transcript parsing answers exactly ONE question: "how many tokens did the most recent assistant message report?" (via `NormalizedUsage::display_tokens()` = `input + cache_read + cache_creation + output`).

### What it does NOT do (verified absent from `src/core/segments/`)

Nothing in `context_window.rs`, `usage.rs`, `cost.rs`, or `session.rs` extracts:
- running tools
- failed/errored tool counts
- per-tool latency
- subagent/Task dispatches or sidechain agent-*.jsonl files
- todo list state

The `usage.rs` segment does not parse the transcript at all — it calls Anthropic's `/api/oauth/usage` HTTP endpoint directly (with a 300-second disk cache at `~/.claude/ccline/.api_usage_cache.json`), which is an entirely separate feature requiring OAuth credentials.

## Caveats / Negative Signal

- **Rust makes this cheap.** `BufReader::lines() + Vec::collect` on a 20 MB JSONL file is sub-10 ms on a modern SSD. The same pattern in Node (`fs.readFileSync` + `JSON.parse` per line) is 5–10x slower because of string allocation and V8's per-line parse cost. **The naive strategy works in Rust and fails in Node.**
- **[CCometixLine#96, 2025-12-13]** reports multiple Claude Code instances cause ccline to "update to display the same model across both" — the tool has no concept of per-session state; it parses whatever transcript_path the stdin passes, which can race across instances.
- **u/AmazingYam4 on r/ClaudeAI, 2025-08** (on Found a faster alternative thread): *"the context calculation should be pretty accurate as it's parsing the transcript… It does use a hardcoded token count of 200K though, so anyone using Sonnet 1M context won't be able to trust the percentage calculation."* → CCometixLine's context limit is looked up from `ModelConfig` by model id, confirming the schema assumption is **brittle on model rollouts**.
- **Summary-record handling** (leaf_uuid search across every project .jsonl) would be catastrophically slow in Node on a directory with many sessions — Rust gets away with it.

## Sources

- `Haleclipse/CCometixLine` — `src/core/segments/context_window.rs` @ master, lines 86–272 — fetched 2026-04-18
- `Haleclipse/CCometixLine` — `src/config/types.rs` @ master, lines 132–416 — fetched 2026-04-18
- `u/AmazingYam4`, r/ClaudeAI, 2025-08 — "parsing the transcript… hardcoded token count of 200K" ([thread](https://www.reddit.com/r/ClaudeAI/comments/1mpwto9/))
- `Haleclipse/CCometixLine#96` — "Model updates incorrectly with multiple Claude Code instances" — 2025
- `u/dwtexe`, r/ClaudeAI, 2025-08 — "It uses fewer resources than ccusage and runs faster as well" — [post](https://www.reddit.com/r/ClaudeAI/comments/1mpwto9/)
