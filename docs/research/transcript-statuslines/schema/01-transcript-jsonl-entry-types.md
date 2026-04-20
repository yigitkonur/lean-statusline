# What entry types and fields exist in the Claude Code transcript JSONL?

**Scope:** The on-disk JSONL schema at `~/.claude/projects/<url-encoded-cwd>/<session-uuid>.jsonl`. Entry types, content block types inside `assistant` records, subagent sidechain detection.
**Last updated:** 2026-04-18
**Confidence:** High — cross-verified across the official `claude-code-transcripts` Rust crate doc, Anthropic's published statusline docs, two deep-dive blog articles, and the actual Haleclipse/Jarrodwatts parser code.

## Answer

Claude Code writes one JSON record per line to an append-only session JSONL. There are **7 stable record-level `type` values**, plus **3 content-block types** inside `assistant.message.content[]`. Subagents dispatched via the `Task` tool write their internal conversation to a sibling file at `<transcript_dir>/agent-<agentId>.jsonl` — the correlation id is `toolUseResult.agentId` in the main transcript's tool_result entries. Fields relevant to statuslines (model, usage, tool name/id, tool result, is_error, timestamps) are stable across Claude Code 2.0.x and 2.1.x; peripheral fields (`cache_creation` nested form, `ephemeral_5m_input_tokens`, queue operation records) have drifted.

## Evidence

### Record-level `type` values

From `databunny.medium.com` "Inside Claude Code: The Session File Format", 2026-02-20:

| `type` | Purpose |
|---|---|
| `user` | User prompts, hook results, injected command output, system caveats |
| `assistant` | Claude's response with content blocks + `message.usage` |
| `tool_result` | Returned tool output; correlates by `toolUseResult.tool_use_id` |
| `system` | Initial system prompt (first record in each session) |
| `summary` | Compaction checkpoint when context nears limit; references `leafUuid` |
| `result` | Final record marking session completion |
| `file-history-snapshot` | Git state at session start |

The `claude-code-transcripts` Rust crate (docs.rs, 2026) confirms the surface area:

> "strongly-typed `Entry` variants covering every line kind the current client emits (user, assistant, system, summary, attachments, progress, tool uses, tool results, usage blocks, cache tokens, etc.)"

Note: `attachments` and `progress` are mentioned by the crate but not by the Medium article — these are likely less stable / less common.

### Shared envelope on every record

From databunny.medium.com and the `tracing-claude-code` langchain plan:

```json
{
  "type": "assistant",
  "uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "parentUuid": "1a2b3c4d-...",
  "timestamp": "2026-02-20T09:14:32.441Z",
  "sessionId": "abc123",
  "cwd": "/home/user/myapp",
  "message": { … }
}
```

`parentUuid` makes the transcript a DAG, not a list. Subagent branches and retries each carry their own chain.

### `assistant.message.content[]` block types

Inside an assistant record, `message.content` is an array of content blocks:

| block `type` | Fields | Used for |
|---|---|---|
| `text` | `text` | Visible reply |
| `tool_use` | `id`, `name`, `input` | Every tool call, including `Task` for subagent spawn |
| `thinking` | `thinking` | Extended thinking scratchpad (Opus with thinking enabled) |

`assistant.message.usage` (top-level, not inside content):

```json
"usage": {
  "input_tokens": 12840,
  "output_tokens": 631,
  "cache_read_input_tokens": 8200,
  "cache_creation": {
    "ephemeral_5m_input_tokens": 3600,
    "ephemeral_1h_input_tokens": 0
  }
}
```

claude-hud normalizes to flat `cache_creation_input_tokens` (src/transcript.ts line 238), accepting the older shape. Newer Opus transcripts use the nested `cache_creation.ephemeral_5m_input_tokens` / `ephemeral_1h_input_tokens` form — claude-hud's accumulator silently zeros that out. **This is schema drift.**

### `tool_result` shape

From the LangChain `tracing-claude-code/subagent-plan.md`:

```json
{
  "type": "tool_result",
  "uuid": "...",
  "parentUuid": "...",
  "toolUseResult": {
    "tool_use_id": "toolu_01abc",
    "content": "...",
    "is_error": false,
    "agentId": "558bc970"   // only present for Task-tool results
  }
}
```

`toolUseResult.agentId` is the key that links a `Task` tool's result back to its subagent transcript file at `<transcript_dir>/agent-<agentId>.jsonl`. **claude-hud does not use this** (it tracks agents via the tool_use block, not by opening the sidechain file).

### Subagent sidechain files

From the HN comment by the Contextify author, 2026-03 ([news.ycombinator.com/item?id=46546937](https://news.ycombinator.com/item?id=46546937)):

> "subagent sidechains (agent-*.jsonl files) when the Task tool spawns parallel workers"

Confirmed in the LangChain subagent plan:

> "Agent Transcript Structure: Location: Same directory as main transcript, named `agent-{agentId}.jsonl`. Format: One JSON object per line, same schema as main transcript. Contains: Agent's internal conversation (user prompts, assistant responses, tool calls)."

Implication for a statusline that wants to show subagent token burn: you need to detect `Task` tool_use in the main file, keep `agentId`, then open and tail the sibling file. Neither claude-hud nor CCometixLine does this.

### Tools seen as `block.name` in `tool_use`

From claude-hud's `extractTarget()` (src/transcript.ts 387–404) + the Claude Code docs: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `Task`, `Agent`, `TodoWrite`, `TaskCreate`, `TaskUpdate`. MCP tools appear with `mcp__<server>__<tool>` style names.

### Queue-operation records (2.0.47+)

From Contextify's "What I found parsing 1,700 transcripts" (r/ClaudeCode 2026-01):

> "The queue operations show up in the transcript as metadata records (`enqueue`, `dequeue`, `remove`, `popAll`)."

These sit alongside the 7 main types and are **not** `type: user | assistant | …` — they're distinct metadata records. claude-hud's `processEntry` silently skips them (no `content` array → early return).

## Caveats / Negative Signal

- **Cache-token shape drift.** `message.usage.cache_creation` went from flat `cache_creation_input_tokens: N` to nested `{ ephemeral_5m_input_tokens, ephemeral_1h_input_tokens }` with Opus 4.5+. Any parser that only reads the flat key silently under-counts. CCometixLine's `RawUsage` handles both shapes via serde `#[serde(default)]`; claude-hud handles only the flat shape.
- **Intermediate usage snapshots.** [ccusage#888, 2026-03](https://github.com/ryoppippi/ccusage/issues/888) — the same `message.id + requestId` can appear twice in the transcript: first an intermediate snapshot with partial `output_tokens`, then a final snapshot with the complete count. First-seen dedupe can undercount output tokens by ~80% in the affected day. **Any accumulator must keep the latest, not the first, for each `(message.id, requestId)` key.**
- **SDK writes orphan UUIDs.** [claude-agent-sdk-typescript#287](https://github.com/anthropics/claude-agent-sdk-typescript/issues/287) — `parentUuid` can reference a UUID that doesn't exist as any entry's uuid. Parsers that assume DAG integrity will dangle.
- **`Agent` vs `Task` naming.** claude-hud accepts both `block.name === 'Task'` and `block.name === 'Agent'` (line 295) as subagent markers. Which is current varies; I did not pin down the version boundary. Treat both.
- **Slash commands and injected context.** `user` records can be plain prompts, slash commands, hook output, or system caveats. The "inside claude code" article classifies these into 5 sub-types but there is no canonical field marking them — it's all heuristic on the content.
- **Session file location pinning.** `~/.claude/projects/<url-encoded-cwd>/*.jsonl` is stable per `code.claude.com/docs/en/agent-sdk/sessions`: *"Sessions are stored under `~/.claude/projects/<encoded-cwd>/*.jsonl`, where `<encoded-cwd>` is the absolute working directory with every slash replaced by a dash."* Within a session, the filename is `<session-uuid>.jsonl`.

## Sources

- Yi Huang, ["Inside Claude Code: The Session File Format and How to Inspect It"](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b), Medium, 2026-02-20
- `claude-code-transcripts` crate — [docs.rs](https://docs.rs/claude-code-transcripts/latest/claude_code_transcripts/) — 2026
- `langchain-ai/tracing-claude-code` — `subagent-plan.md` @ main — [agent-{agentId}.jsonl location](https://github.com/langchain-ai/tracing-claude-code/blob/main/subagent-plan.md)
- `ryoppippi/ccusage#888` — intermediate usage snapshots — 2026-03-11
- `anthropics/claude-agent-sdk-typescript#287` — parentUuid orphans
- `u/jetsetter` (Contextify), r/ClaudeCode, 2026-01 — queue records — +7 upvotes, [post](https://www.reddit.com/r/ClaudeCode/comments/1pjbriy/)
- Contextify author on HN `item?id=46546937`, 2026-03 — subagent sidechains
- Claude Code Docs — [sessions](https://code.claude.com/docs/en/agent-sdk/sessions) — session file path contract
