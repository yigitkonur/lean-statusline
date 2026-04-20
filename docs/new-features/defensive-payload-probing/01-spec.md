# Defensive payload probing

**Tier:** S | **Composite:** 9.50 | **Original ID:** N10 (new from research) | **Depends on:** — | **Blocks:** native-subagent-count, width-adaptive-layout, pace-delta

## 1. What it is

A hardening pass on every stdin field access so `lean-statusline` tolerates (a) undocumented fields that already shipped in April 2026 — `effortLevel`, `skills`, `subagents`, terminal `columns`/`rows` — and (b) future additions. Each read goes through a single typed probe with explicit default, coerced type, and telemetry. No segment crashes, no silent empty renders, ever.

## 2. Showcase

```
Before (current lib/segments.mjs line 173 resolveEffortLevel)
┌──────────────────────────────────────────────────────────┐
│ envLevel = process.env.CLAUDE_CODE_EFFORT_LEVEL          │   ← reads env only
│ or   settings.json.env.CLAUDE_CODE_EFFORT_LEVEL          │   ← misses shipped field
│                                                          │
│ Claude Code 2.1.109+ now sends  input.effortLevel        │   ← IGNORED
└──────────────────────────────────────────────────────────┘

After
┌──────────────────────────────────────────────────────────┐
│ probe('effortLevel', [                                    │
│   () => input.effortLevel,              // shipped, undoc │
│   () => process.env.CLAUDE_CODE_EFFORT_LEVEL,             │
│   () => readSettingsEnv('EFFORT_LEVEL'),                  │
│ ], { coerce: oneOf(['auto','low','medium','high']) })     │
└──────────────────────────────────────────────────────────┘
```

## 3. Why we need it

- **Claude Code ships payload fields faster than it updates docs.** Agent 4 confirmed `effortLevel`, `skills`, running `subagents`, terminal `columns/rows` all present in 2.1.109 but absent from the public schema.
- **Every segment currently hard-accesses fields** like `input.cost.total_cost_usd` with optional chaining but no type coerce, no fallback chain, no version log.
- **Silent regressions happen.** The v2.1.100 silent-token bug (Agent 2) zeroed `cost.total_cost_usd` for affected users for hours before anyone noticed because displays rendered `$0.00` indistinguishable from "session just started."
- **Defensive probing puts a single choke-point** on every external read — making later audits ("what broke when?") a grep instead of a forensic session.

## 4. Ecosystem examples

- **CCometixLine** ships `RawUsage` with `#[serde(default)]` + custom deserialize for both flat (`cache_creation_input_tokens`) and nested (`cache_creation.ephemeral_5m_input_tokens`) shapes. Evidence: `docs/research/transcript-statuslines/02-schema/02-cache_creation-flat-vs-nested.md`.
- **claudeline** (Go) uses per-source structs with explicit zero-defaults and logs schema-drift warnings to `~/.claude/claudeline/debug.log`.
- **claude-powerline** does NOT do this — and users report "silent blank segments after every Claude Code update" (`u/jivenossauro`, Agent 3).

The lesson: the Rust projects got type-safety for free; the TypeScript/JavaScript projects that survive Claude Code updates gracefully are the ones that explicitly probed.

## 5. Position on the line

Not a segment — a library layer under `lib/probe.mjs`. Every segment delegates reads through it. Zero pixels on screen.

## 6. How users use it

Invisible in happy path. Surface only via:

```bash
lean-statusline doctor           # reports which undocumented fields are live in current stdin
lean-statusline doctor --schema  # dumps observed payload shape to stderr
```

## 7. Default mode

**Always on.** It IS the read path.

## 8. Visualization

Not applicable (infrastructure).

Debug mode (`LEAN_STATUSLINE_DEBUG_SCHEMA=1`) prints one line to stderr per render listing fields that fell through to default:

```
lean-statusline: missing fields in payload → agent.name, rate_limits, vim
lean-statusline: novel fields observed → effortLevel, skills (consult docs/research/)
```

## 9. Data source

The stdin JSON blob itself. No transcript, no fs, no spawn.

## 10. Doability

**Trivial.** Pure Node. Only caveat: don't slow down the hot path. Probes must be sync-only, zero allocation for the happy path.

## 11. Performance budget

- Cold: +0.2 ms amortized (one Map lookup per segment read).
- Warm: +0.1 ms.
- Zero extra allocations when field is present.

## 12. Reliability & failure modes

- **Missing field →** returns explicit sentinel `UNSET`. Segments already skip on `null`; they skip on `UNSET` too.
- **Wrong type** (e.g. `used_percentage` arrives as string in some Claude Code builds) → coerce via declared validator, log once per session to `~/.claude/lean-statusline.debug.log` behind `LEAN_STATUSLINE_DEBUG_SCHEMA=1`.
- **Probe throws** → swallow, return `UNSET`. Statusline never crashes on bad payload.

## 13. Config schema

No user-facing config. Internal probe map:

```js
// lib/probe.mjs
export const PROBES = Object.freeze({
  'model.display_name':      { from: 'stdin', default: 'Claude', coerce: str },
  'context_window.used_percentage': { from: 'stdin', default: null, coerce: pct },
  'rate_limits.five_hour.used_percentage': { from: 'stdin', default: null, coerce: pct },
  'effortLevel':             { from: ['stdin', 'env:CLAUDE_CODE_EFFORT_LEVEL', 'settings.env'], default: null, coerce: enumOf(['auto','low','medium','high']) },
  'skills':                  { from: 'stdin', default: [], coerce: arr(str) },
  'subagents':               { from: 'stdin', default: [], coerce: arr(obj) },
  'terminal.columns':        { from: ['stdin', 'env:COLUMNS'], default: null, coerce: int },
  'terminal.rows':           { from: ['stdin', 'env:LINES'],   default: null, coerce: int },
  // ... one per documented + observed field
});
```

## 14. Code integration

**New file:** `lib/probe.mjs` (~120 LOC)

```js
const UNSET = Symbol('UNSET');

export function probe(path, input, chain = null) {
  const spec = PROBES[path];
  if (!spec) return UNSET;
  for (const src of (chain ?? spec.from)) {
    const v = readSource(src, path, input);
    if (v !== UNSET && v != null) return coerce(v, spec.coerce) ?? UNSET;
  }
  return spec.default ?? UNSET;
}

function readSource(src, path, input) { /* stdin | env:X | settings.env */ }
function coerce(v, validator) { return validator(v); }
```

**Edit every segment** in `lib/segments.mjs` to call `probe()` instead of direct `input?.foo?.bar`. Example migration:

```js
// Before (segments.mjs:238):
model(ctx) {
  const raw = ctx.input?.model?.display_name ?? 'Claude';
  return ctx.palette.blue(formatModelName(raw, ctx.cfg.modelFormat));
}

// After:
model(ctx) {
  const raw = probe('model.display_name', ctx.input);
  if (raw === UNSET) return null;     // silent-when-absent, matches the rest
  return ctx.palette.blue(formatModelName(raw, ctx.cfg.modelFormat));
}
```

**Update `bin/lean-statusline.mjs` `renderFromStdin()`** to thread a probe context onto `ctx`:

```js
const ctx = {
  input, cfg, palette, icons, rateLimits,
  probe: (p) => probe(p, input),        // ← new
  dangerousPerms, effortLevel, contextPct,
};
```

## 15. Dependencies

- None. Ship first.

## 16. Testing

- **Unit tests** (`test/probe.test.mjs`): every coercer round-trips, unknown fields return `UNSET`, fallback chain respects order.
- **Fixture corpus** under `test/fixtures/payloads/`: one file per Claude Code minor version (2.1.80, 2.1.90, 2.1.100, 2.1.109). Assert no segment throws on any fixture.
- **Doctor command** runs the probe map against current stdin and prints diff against the expected schema.

## 17. Rollout plan

- Release as `lean-statusline@1.2.0` (minor — no breaking change for users).
- Enable `LEAN_STATUSLINE_DEBUG_SCHEMA=1` in release notes for users who hit schema surprises.
- Internally flip every segment over in one PR; no gradual migration needed since API is compatible.

## 18. Regression risks

- **Over-eager coercion** could turn a valid `0` into `null`. Mitigation: coercers distinguish nullish from `0` explicitly.
- **Probe cache** across renders could hide transient field disappearance. Mitigation: no cross-render cache; each render probes fresh.

## 19. Success metrics

- Zero segment crashes on fixture corpus covering 2.1.80 through current.
- `doctor --schema` diff against expected schema reports 0 missing fields in 95% of user installs by v1.3.0.
- Support tickets mentioning "segment blank after update" drop to zero.

## 20. Open questions

- Whether to ship observed-schema collection (with opt-in) to help track what Anthropic ships next. Lean ethos says no; pragmatism says a local-only `~/.claude/lean-statusline.schema-observed.json` is harmless.
- Whether to fail-fast on *unknown* fields in strict mode (off by default). Useful for CI of statusline authors who want to be notified when Anthropic ships something new.
