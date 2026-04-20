# Agent segment — only when non-default

**Tier:** S | **Composite:** 9.70 | **Original ID:** #17 | **Depends on:** conditionals-schema

## 1. What it is

Collapse the `agent` segment's visibility rule from hand-coded `if (!name) return null` to a declarative conditional that hides the segment whenever `agent.name` is absent, `"default"`, `"claude"`, or any user-declared "noise" value. Keeps the screen quiet in the 95% of sessions where no custom agent is active, loud when it matters.

## 2. Showcase

```
Before — current behavior (lib/segments.mjs:391)
  ▸ On default agent sessions: segment hides ONLY when field absent.
    With `agent.name: "default"`, renders: 🤖 default   ← noise.
  ▸ On --agent reviewer sessions:     renders: 🤖 reviewer  ✓

After — this feature
  ▸ No agent flag                →  (nothing)           ✓
  ▸ --agent default              →  (nothing)           ✓ was noise
  ▸ --agent claude               →  (nothing)           ✓ was noise
  ▸ --agent security-reviewer    →  🤖 security-reviewer ✓
  ▸ --agent my-custom-planner    →  🤖 my-custom-planner ✓

User-tunable per project:
  conditionals.agent.hide_when_equals["agent.name"]: [
    "default", "claude", "generalist"    ← project adds "generalist" as noise
  ]
```

## 3. Why we need it

- **Claude Code's default agent often reports as `"default"` or `"claude"`**, not absent — which defeats the current silent-when-absent logic.
- **Agents are per-project concepts.** What's a "noise agent" in one repo (e.g. the default reviewer) is a meaningful one in another. Config-driven noise-suppression is essential.
- **Highest-value cheap win.** Score 9.70 because impact is real (clutter removed), cost is tiny (one config block), reliability is total (stdin-only).

## 4. Ecosystem examples

- **claude-powerline** shows agent unconditionally when field is present — produces the noise problem.
- **ccstatusline** has a `hidden` bool but no value-based hiding, so users have to manually toggle widgets per project.
- **claudeline** silents by plan/role match — same idea, coarser granularity.
- **Nobody** ships value-based hiding as the default, though multiple GitHub issues on ccstatusline and claude-powerline request it.

## 5. Position on the line

Existing `agent` segment slot in `full` preset, between `cost` and `vim`. No layout change.

## 6. How users use it

Default behavior ships in the `full` preset:

```json
{
  "conditionals": {
    "agent": {
      "requires": ["agent.name"],
      "hide_when_equals": { "agent.name": ["default", "claude"] }
    }
  }
}
```

Users extend per-repo via `.claude/lean-statusline.json`:

```json
{
  "conditionals": {
    "agent": {
      "hide_when_equals": { "agent.name": ["default", "claude", "orchestrator"] }
    }
  }
}
```

## 7. Default mode

**Always on** in `full` preset with the above defaults. `minimal` and `compact` don't include the `agent` segment at all.

## 8. Visualization

No change to the segment render itself — `🤖 <name>` in magenta on unicode, `agent <name>` on ASCII. The conditional controls visibility, not appearance.

## 9. Data source

`input.agent.name` (stdin, always absent when `--agent` not set per docs).

## 10. Doability

**Trivial.** Pure configuration. Depends on conditionals-schema landing first; nothing else.

## 11. Performance budget

- Cost: the same <0.1 ms the conditionals evaluator charges per segment. Zero new I/O.

## 12. Reliability & failure modes

- **Agent named something quirky** like `" default "` (trailing whitespace): not caught by array match. Mitigation: conditionals evaluator trims strings before equality check.
- **User lists a non-string value** in `hide_when_equals`: accepted; `probe()` coerces and comparison handles any JSON scalar.

## 13. Config schema

Minimal — covered by conditionals-schema. No new schema here.

## 14. Code integration

**Edit `lib/presets.mjs`** to add the default conditional under each preset that includes `agent`:

```js
full: {
  name: 'full',
  // ... existing ...
  config: {
    segments: [ /* unchanged */ ],
    show: { /* unchanged */ },
    conditionals: {
      agent: {
        requires: ['agent.name'],
        hide_when_equals: { 'agent.name': ['default', 'claude'] },
      },
      // ... other segment conditionals from other features ...
    },
  },
},
```

**Edit `lib/segments.mjs` agent(ctx)`** to drop the hand-coded guard (conditionals now gates):

```js
agent(ctx) {
  const name = ctx.input?.agent?.name;
  // ↓ dropped: if (!name) return null;  (handled by conditionals.requires)
  return `${ctx.palette.dim(ctx.icons.agent)} ${ctx.palette.magenta(name)}`;
}
```

No other changes.

## 15. Dependencies

- `conditionals-schema` must land first.

## 16. Testing

- **Unit** (`test/segments.test.mjs`): snapshot tests for each of 5 cases: (absent, default, claude, custom, custom with project override).
- **Manual smoke**: `lean-statusline --preset full` under 3 configurations.

## 17. Rollout plan

- Ship in the same release as `conditionals-schema` (`@1.4.0`).
- Release note: "agent segment no longer shows when Claude Code reports default/claude; customize via `.claude/lean-statusline.json`".

## 18. Regression risks

- **User expects to see `🤖 default`** for some reason: documented in release notes with an opt-out snippet:
  ```json
  { "conditionals": { "agent": { "hide_when_equals": {} } } }
  ```

## 19. Success metrics

- In user feedback, agent segment clutter reports drop to zero.
- Project-override usage trackable via doctor (local only) — aim for >20% of `full`-preset users adding at least one custom noise value.

## 20. Open questions

- Should the hide list be regex-capable? Not in v1. Values are usually literal.
- Should we ship a community-curated noise list per framework (e.g. LangGraph agents, Crew agents)? Maybe — publish as `lean-statusline-agents/*.json` presets later.
