# Conditionals schema

**Tier:** S | **Composite:** 9.40 | **Original ID:** #93 (rewritten from Agent 3 evidence) | **Depends on:** session-state-file | **Blocks:** agent-non-default, project-dir-drift, worktree-always-on, suppress-cost-zero, reset-countdown-collapse (partially)

## 1. What it is

A six-field per-segment config block that turns "show only when meaningful" from hand-coded `if (x == null) return null` into declarative data. Every field is directly traced to a shipping project (ccstatusline, claude-powerline, cship, claudeline). No expression DSL. No wall-clock decay (research proved it's impossible). Replaces approximately 15 hand-coded `return null` guards across `lib/segments.mjs` with a single evaluator.

## 2. Showcase

```
                  Declarative segment conditionals
┌──────────────────────────────────────────────────────────────────┐
│  segment: agent                                                   │
│  ──────────                                                       │
│  requires: [ "agent.name" ]              ← silent when field absent│
│  hide_when_equals:                                                │
│    agent.name: [ "default", "claude" ]   ← silent when noise      │
│  threshold: null                         ← no % gating            │
│  max_messages: null                      ← no event-count decay   │
│  cache: { ttl_ok: 60, ttl_fail: 15 }     ← if segment is derived  │
│  detect_files: []                        ← no fs probe            │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼    evaluator chain
┌──────────────────────────────────────────────────────────────────┐
│ shouldRender(segment, ctx) = AND(                                 │
│   requires.every(p => probe(p, ctx.input) !== UNSET),             │
│   !hide_when_equals.some((p, vs) => vs.includes(probe(p))),       │
│   threshold.hide_below <= probe(metric) <= 100,                   │
│   ctx.state.messagesSinceLastChange[track] < max_messages,        │
│   cache.fresh(),                                                  │
│   detect_files.every(fs.existsSync),                              │
│ )                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Why we need it

- **The current code has ~15 copy-pasted guards.** `return null when field absent` is scattered across `lib/segments.mjs`. Each segment re-implements silent-when-meaningful logic slightly differently.
- **Users want per-repo tuning.** Being able to say "in this repo, always show the agent segment" or "never show cost here" is a feature-multiplier that requires config-not-code.
- **Research settled the schema shape.** Agent 3 reviewed ccstatusline, claude-powerline, cship, claudeline. Every field below is validated across at least two of those projects. Evidence: `docs/research/statusline-conditionals/recommendation/01-lean-statusline-conditionals-schema.md`.
- **The "decay" red herring is dead.** Wall-clock decay can't work (Agent 3 + 4 both confirmed). We replace `decay_seconds` with `max_messages` — event-count — which IS reliable.

## 4. Ecosystem examples

- **ccstatusline** (TypeScript) — widgets declare `hidden` bool + threshold colors per widget. No `max_messages`. Evidence: `docs/research/statusline-conditionals/ccstatusline/01-widget-config-and-hide-semantics.md`.
- **claude-powerline** — segments have `show` bool + `warningThreshold` single band. No per-segment cache. Evidence: `docs/research/statusline-conditionals/claude-powerline/01-segment-schema-and-per-project-override.md`.
- **cship** — inherits Starship's `format` + `detect_files` + `detect_folders` + `warn_threshold` + `critical_threshold`. Two-band thresholds validated. Evidence: `docs/research/statusline-conditionals/cship/01-starship-inherited-thresholds-and-format.md`.
- **claudeline** — per-source cache with `ttl_ok` and `ttl_fail`. The OK-TTL-longer-than-FAIL-TTL pattern is the critical lesson. Evidence: `docs/research/statusline-conditionals/claudeline/01-only-shows-when-meaningful-and-cache-ttls.md`.

Lean-statusline adopts the union of what works, drops what's unsafe (wall-clock decay, expression DSL).

## 5. Position on the line

Not a segment. A layer in the render path. Adds ~15 LOC to `renderLine()` in `lib/segments.mjs`.

## 6. How users use it

```json
{
  "conditionals": {
    "agent": {
      "requires": ["agent.name"],
      "hide_when_equals": { "agent.name": ["default", "claude"] }
    },
    "ctx": {
      "threshold": { "warn_at": 70, "critical_at": 90, "hide_below": null }
    },
    "session-name": {
      "requires": ["session_name"],
      "max_messages": 3
    },
    "cost": {
      "hide_when_equals": { "cost.total_cost_usd": [0, null] }
    },
    "5h": {
      "cache": { "ttl_ok": 60, "ttl_fail": 15 }
    }
  }
}
```

Preset defaults ship in `lib/presets.mjs` so users don't write these by hand unless overriding.

## 7. Default mode

**Always on.** Each segment's entry lives in the preset; users can override per-key in their own `lean-statusline.json`.

## 8. Visualization

Not user-facing. Debug mode logs one line per skipped segment:

```
lean-statusline: skipped 'agent' — hide_when_equals matched (value=default)
lean-statusline: skipped 'cost' — hide_when_equals matched (value=0)
lean-statusline: rendered 'session-name' — max_messages 2/3
```

## 9. Data source

Consumes from (a) the probe map (stdin), (b) session-state-file (counters), (c) filesystem (detect_files only). No network.

## 10. Doability

**Straightforward** — it's just a pure function `shouldRender(segmentName, ctx) → bool` plus a small evaluator for each of the six fields. All six map to existing data sources. No new dependencies.

## 11. Performance budget

- Per-segment evaluation: **<0.1 ms**.
- Whole-line evaluation (20 segments): **<2 ms**.
- Zero I/O except `detect_files` (which is `fs.existsSync`, O(1) per path).

## 12. Reliability & failure modes

- **Malformed `conditionals` block in user config**: validate at config-load time (`lib/config.mjs#validateConfig`). Reject with a clear error, fall back to preset defaults.
- **Unknown field**: warn, ignore. Forward-compat.
- **`requires` points to an invalid probe path**: warn at first render, segment stays visible (fail-open — better to show extra than hide wrongly).
- **Cache TTL = 0**: disables caching gracefully.

## 13. Config schema

```jsonc
{
  "conditionals": {
    "<segment-name>": {
      // Silent-when-absent: probe paths that must be non-UNSET
      "requires": ["path.to.field"],

      // Silent-when-noise: hide if any of these values match
      "hide_when_equals": {
        "path.to.field": ["default", 0, null, ""]
      },

      // Two-band % threshold colouring + optional hide-below gate
      "threshold": {
        "warn_at": 50,        // inclusive lower bound for "warn" color
        "critical_at": 90,    // inclusive lower bound for "critical"
        "hide_below": null    // optional: hide segment entirely below this %
      },

      // Event-count decay (replaces invalid wall-clock decay)
      // Segment visible for the first N assistant messages after the tracked
      // field changes. null = no gating.
      "max_messages": null,
      "max_messages_track": "path.to.field",   // which field to watch

      // Per-segment cache — for derived/expensive segments
      "cache": {
        "ttl_ok": 60,         // seconds, on successful compute
        "ttl_fail": 15        // seconds, on error (shorter so we retry sooner)
      },

      // Only render when these paths exist — for segments that need external files
      "detect_files": [".git/MERGE_HEAD"]
    }
  }
}
```

## 14. Code integration

**New file:** `lib/conditionals.mjs` (~150 LOC)

```js
import { existsSync } from 'node:fs';
import { probe } from './probe.mjs';

export function shouldRender(segmentName, segmentCfg, ctx) {
  const c = segmentCfg?.conditionals ?? ctx.cfg.conditionals?.[segmentName];
  if (!c) return true;  // no rules = always show

  // 1. requires
  if (c.requires?.length) {
    for (const p of c.requires) {
      if (probe(p, ctx.input) === UNSET) return false;
    }
  }

  // 2. hide_when_equals
  if (c.hide_when_equals) {
    for (const [path, values] of Object.entries(c.hide_when_equals)) {
      const v = probe(path, ctx.input);
      if (values.includes(v)) return false;
    }
  }

  // 3. threshold.hide_below
  if (c.threshold?.hide_below != null) {
    const metric = ctx[segmentName]?.pct ?? ctx.contextPct;
    if (metric != null && metric < c.threshold.hide_below) return false;
  }

  // 4. max_messages
  if (c.max_messages != null && c.max_messages_track) {
    const n = ctx.state?.counters?.messagesSinceLastChange?.[c.max_messages_track] ?? 0;
    if (n >= c.max_messages) return false;
  }

  // 5. detect_files
  if (c.detect_files?.length) {
    if (!c.detect_files.some(f => existsSync(f))) return false;
  }

  // cache is handled at segment-compute time, not here
  return true;
}

export function thresholdColor(pct, threshold, palette) {
  if (pct >= (threshold.critical_at ?? 90)) return palette.red;
  if (pct >= (threshold.warn_at ?? 70)) return palette.yellow;
  return palette.green;
}
```

**Edit `lib/segments.mjs renderLine()`** to gate via `shouldRender`:

```js
import { shouldRender } from './conditionals.mjs';

export function renderLine(ctx) {
  const lines = [[]];
  const seen = new Set();
  for (const rawName of ctx.cfg.segments) {
    if (rawName === '\n') { lines.push([]); continue; }
    const name = SEGMENT_ALIASES[rawName] || rawName;
    if (seen.has(name)) continue;
    const fn = SEGMENTS[name];
    if (!fn) continue;
    if (!shouldRender(name, null, ctx)) continue;   // ← new
    const rendered = fn(ctx);
    if (rendered != null && rendered !== '') {
      lines[lines.length - 1].push(rendered);
      seen.add(name);
    }
  }
  // ... rest unchanged ...
}
```

**Remove now-obsolete guards** from each segment function:
- `segments.mjs:244` `if (pct == null) return null;` → move to `conditionals.ctx.requires = ["context_window.used_percentage"]`
- `segments.mjs:274` same for `5h`
- `segments.mjs:362` cost null check → `hide_when_equals: { "cost.total_cost_usd": [0, null] }`
- `segments.mjs:384` worktree name check → `requires: ["worktree.name"]`
- `segments.mjs:391` agent name check → `requires: ["agent.name"]`
- ~10 more similar sites

**Update `lib/config.mjs`** to validate `conditionals` block shape; update `lib/presets.mjs` to ship default conditionals per preset.

## 15. Dependencies

- `session-state-file` (for `max_messages` event counter).
- `defensive-payload-probing` (for probe-path dereference).

## 16. Testing

- **Unit** (`test/conditionals.test.mjs`):
  - Each of 6 fields exercised independently.
  - Missing block → always render.
  - Invalid block → logs warning + falls back to preset.
  - `max_messages` counts events correctly across simulated renders.
- **Migration suite**: assert every segment's new conditional config reproduces the old hand-coded guard behavior exactly (capture snapshot before, diff after).

## 17. Rollout plan

- Ship in `lean-statusline@1.4.0`.
- Release notes show before/after per segment.
- Old hand-coded guards removed in same PR (no dual-mode; cleaner).
- Preset defaults updated so existing users see no behavior change.

## 18. Regression risks

- **Guard removal changes a segment's visibility in a subtle case.** Mitigation: snapshot tests of every preset rendered against 20+ fixture payloads.
- **Performance:** 20 segments × 6-field eval per render = 120 ops × <0.1 ms = <2 ms. Measured; acceptable.
- **User config override** that's looser than the default could re-surface buggy segments. Mitigation: doctor lints the merged config and warns.

## 19. Success metrics

- ~15 `return null` sites removed from `segments.mjs`.
- New segment authoring requires zero copy-pasted guard code.
- Three A-tier features (agent-non-default, worktree-always-on, suppress-cost-zero) ship as pure config additions without touching `segments.mjs`.

## 20. Open questions

- Should `hide_when_equals` support regex? Not in v1 — keeps the evaluator trivial. Revisit if users ask.
- Should `threshold` be extended with `info_at` for a fourth band? Probably — add in v2 once two-band thresholds land.
- Should `max_messages` also support `min_messages` (don't show for first N)? Useful for onboarding hints. Defer.
