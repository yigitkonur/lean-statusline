# Native subagent count

**Tier:** A | **Composite:** 8.80 | **Original ID:** #23 (promoted from D by Agent 4) | **Depends on:** defensive-payload-probing | **Fallback:** transcript-bookmark-reducer

## 1. What it is

Render `🤖×3` inline when one or more subagents are currently active. Uses the **undocumented `subagents` payload field** shipped in Claude Code 2.1.x (issue #47857, discovered by Agent 4). Falls back to transcript-bookmark-reducer's `state.subagents` count when the payload field is absent. Silent when no subagents are running.

## 2. Showcase

```
                Native subagent count
┌───────────────────────────────────────────────────────────────┐
│  No subagents active:                                          │
│    🔒 box · Opus · ✎ 14% · repo (main)                         │
│                                                                │
│  One Task in flight:                                           │
│    🔒 box · Opus · ✎ 14% · repo (main) · 🤖×1                  │
│                                                                │
│  Parallel dispatch (3 subagents):                              │
│    🔒 box · Opus · ✎ 26% · repo (main) · 🤖×3                  │
│                                               ↑ dims on ≤1,    │
│                                                 bright on ≥2   │
│                                                                │
│  Full-preset verbose form (optional):                          │
│    🤖×3 (research, review, test)                               │
└───────────────────────────────────────────────────────────────┘
```

## 3. Why we need it

- **Agent 4 discovered this field in Claude Code 2.1.109** but it's missing from public docs. The undocumented `subagents` array is exactly the data we need, already in stdin, no transcript parsing required on the hot path.
- **Multi-agent workflows are the #1 use case** that existing statuslines fail to surface. claude-hud parses the transcript for this. Lean can beat it with native payload.
- **Reset from D-tier to A-tier** based solely on the shipped field — this is the cleanest "research changed the score" case in the set.
- **Fallback to transcript reducer** ensures the feature works even on Claude Code builds that haven't shipped the field yet.

## 4. Ecosystem examples

- **claude-hud** — transcript-parses for this. Mediocre performance; our research showed the `(mtime, size)` cache is effectively always invalidated.
- **CCometixLine** — Rust transcript parse. Fast but heavy.
- **ccstatusline, claude-powerline, cship** — don't surface subagents at all.
- **Nobody** reads the native `subagents` field yet — because nobody's looked.

## 5. Position on the line

- `minimal`: hidden (respecting minimalist ethos).
- `compact`: line 1, between `dir` and line-break when count ≥ 1.
- `full`: line 1, with optional verbose `(name, name)` tail.

Width-adaptive drops the verbose tail at <100 cols, then the whole segment at <76 cols.

## 6. How users use it

Default-on in compact/full. Toggle:

```json
{ "show": { "subagents": false } }
```

Verbose tail:

```json
{ "subagents": { "showNames": true, "maxNames": 3 } }
```

## 7. Default mode

- `compact`, `full`: **on when count ≥ 1**. Silent at count = 0.
- `minimal`: **off** (philosophically quiet preset).

## 8. Visualization

- Unicode: `🤖×3` in magenta. Dim at count 1 (routine), normal at 2, bold at 3+.
- ASCII: `agents:3`.
- Verbose (optional): `🤖×3 (research, review, test)` — names joined with commas, clamped to `maxNames` then `...`.

## 9. Data source

Priority chain (probed via defensive-payload-probing):
1. `input.subagents` — undocumented array of objects with `{ id, name, status }`.
2. Fallback: transcript reducer's `state.subagents` count (from open `Task`/`Agent` tool_use blocks without matching tool_result).

## 10. Doability

**Trivial** for the native path — one probe + one count. Transcript fallback requires `transcript-bookmark-reducer` which is a separate S-tier feature. Ship native-only first; add fallback in next release.

## 11. Performance budget

- Native path: **<0.05 ms**.
- Fallback path: transcript reducer already budgeted; no extra cost here.

## 12. Reliability & failure modes

- **`subagents` field absent** (pre-2.1.x Claude Code): fallback to transcript reducer or silent when reducer disabled.
- **Field exists but empty array**: count = 0 → segment hidden (conditionals).
- **Field format surprises** (e.g. an object instead of array): defensive-probing coerces, count defaults to 0.
- **Status field not "running"** (some items may report "completed"): filter to active only.

## 13. Config schema

```json
{
  "show": { "subagents": true },
  "subagents": {
    "showNames": false,
    "maxNames": 3,
    "dimThreshold": 1,
    "boldThreshold": 3
  }
}
```

## 14. Code integration

**Edit `lib/segments.mjs`** — add new segment:

```js
// New segment registered in SEGMENTS:
subagents(ctx) {
  // Primary: native payload field
  let list = probe('subagents', ctx.input);
  if (list === UNSET || !Array.isArray(list)) {
    // Fallback: transcript reducer state
    const rs = ctx.transcript?.subagents;
    list = rs ? Object.values(rs).map(v => ({ name: v.name, status: 'running' })) : [];
  }
  const active = list.filter(s => !s.status || s.status === 'running');
  const n = active.length;
  if (n === 0) return null;

  const bold = n >= (ctx.cfg.subagents?.boldThreshold ?? 3);
  const dim  = n <= (ctx.cfg.subagents?.dimThreshold ?? 1);
  const color = ctx.palette.magenta;
  const body = `${ctx.icons.agent}×${n}`;
  const styled = dim ? ctx.palette.dim(body) : color(body);

  if (ctx.cfg.subagents?.showNames) {
    const names = active.slice(0, ctx.cfg.subagents.maxNames ?? 3).map(s => s.name);
    const suffix = active.length > names.length ? '…' : '';
    return `${styled} ${ctx.palette.dim(`(${names.join(', ')}${suffix})`)}`;
  }
  return styled;
}
```

**Edit `lib/config.mjs KNOWN_SEGMENTS`** to include `'subagents'`.

**Edit `lib/presets.mjs`** — add `subagents` to compact and full preset segment arrays after `dir`.

## 15. Dependencies

- `defensive-payload-probing` — required.
- `transcript-bookmark-reducer` — optional fallback; feature ships without it.
- `conditionals-schema` — used for the count=0 hide via `hide_when_equals`.

## 16. Testing

- **Unit** (`test/segments.test.mjs`):
  - `subagents = []` → segment hidden.
  - `subagents = [1 active]` → `🤖×1` dim.
  - `subagents = [3 active]` → `🤖×3` bold magenta.
  - With `showNames: true` → names + clamp.
  - Native absent + transcript reducer state with 2 tasks → `🤖×2`.
  - Both absent → hidden.

## 17. Rollout plan

- Ship native-only in `@1.5.0`. Release notes mention the undocumented field and we fall back gracefully if removed.
- Add transcript fallback in `@1.6.0` alongside transcript-bookmark-reducer.

## 18. Regression risks

- **Anthropic removes / renames the field**: fallback to transcript handles it; telemetry logs one-line warning once per session.
- **Field changes shape** (object keyed by id, rather than array): defensive-probing's coercer handles coarsely; specific migration shipped when observed.
- **Users confused by magenta×N format**: release notes show example.

## 19. Success metrics

- Native path hit rate >90% of renders on current Claude Code builds (measurable via local doctor telemetry).
- Transcript-fallback measurable latency unchanged.
- Screenshots in the wild feature the segment prominently.

## 20. Open questions

- Should count include completed-this-session subagents? No — only currently-running. Stale data confuses.
- Click-to-expand the names tail? OSC 8 broken per Agent 4; skip.
- Show elapsed time per subagent? Way too much chrome. Skip.
