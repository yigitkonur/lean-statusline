# Per-session state file

**Tier:** S | **Composite:** 9.55 | **Original ID:** #97 | **Depends on:** — | **Blocks:** transcript-bookmark-reducer, conditionals-schema (`max_messages`), pace-delta (not strictly, but delta-on-render ideas yes), reset-countdown-collapse, every "changed since last render" idea

## 1. What it is

A small JSON file at `/tmp/lean-statusline-state-${session_id}.json` that persists (a) last-seen values for delta detection, (b) event counts for `max_messages` gating in the conditionals schema, (c) per-session cache keys. Keyed by `session_id` exactly as the official docs recommend for avoiding concurrent-session cache collisions. Same file layout as the existing `lib/usage.mjs` cache pattern — that file already scored it right; this generalizes it.

## 2. Showcase

```
                session-state file layout
┌──────────────────────────────────────────────────────────────┐
│ /tmp/lean-statusline-state-abc123.json                       │
│ {                                                             │
│   "schemaVersion": 1,                                         │
│   "lastSeen": {                                               │
│     "used_percentage": 38,          ← for Δ ctx% flash       │
│     "version": "2.1.109",           ← for upgrade toast      │
│     "agent.name": "default",        ← for change detection   │
│     "session_name": "debug-auth"    ← for rename-change      │
│   },                                                          │
│   "counters": {                                               │
│     "messagesSinceLastChange": {                              │
│       "session_name": 2,            ← for max_messages gating│
│       "version": 7                                            │
│     },                                                        │
│     "totalRenders": 142,                                      │
│     "firstSeenAt": 1713446400000                              │
│   }                                                            │
│ }                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 3. Why we need it

- **Every "show for N" idea needs state.** Without it, features like pace delta's color on drift, "flash on threshold crossed", or conditionals' `max_messages` are impossible.
- **Docs mandate the key.** The Claude Code statusline docs (Caching example) explicitly say "Use the `session_id`... Process-based identifiers defeat the cache."
- **`lib/usage.mjs` already does this** for rate-limit caching (see `cachePath(sessionId)` at lines 14–19). This feature generalizes it to arbitrary state.
- **Concurrent sessions.** Users routinely run 2–5 Claude Code instances side-by-side; a shared state file would clobber.

## 4. Ecosystem examples

- **claudeline (Go)** keeps per-source cache files under `~/.claude/claudeline/cache/<session>-<source>.json` with OK-TTL and FAIL-TTL fields. Evidence: `docs/research/statusline-conditionals/claudeline/01-only-shows-when-meaningful-and-cache-ttls.md`.
- **ccstatusline** DOES NOT persist per-session state, which is why it can't implement threshold flashes or change animations.
- **claude-hud** uses a transcript-keyed cache (`mtimeMs + size`) but it's effectively always invalidated because the statusline event IS the transcript growing — a cautionary tale, not a pattern to copy.

## 5. Position on the line

None. Infrastructure.

## 6. How users use it

Invisible. Operational surface:

```bash
lean-statusline doctor             # reports size + age of state files
lean-statusline doctor --clean     # removes stale files (>24h)
```

Users never read or write the file themselves.

## 7. Default mode

**Always on.** Created on first render of a session, deleted after 24h via lazy GC on next statusline invocation that sees an old file.

## 8. Visualization

None. Debug mode (`LEAN_STATUSLINE_DEBUG_STATE=1`) prints a one-line summary of what changed since last render:

```
lean-statusline: state Δ — used_percentage 34→38, messagesSinceLastChange.session_name 1→2
```

## 9. Data source

- Read side: the file itself (JSON).
- Write side: every render writes a fresh snapshot of `lastSeen` + increments counters.
- Key: `session_id` from stdin, sanitized like `lib/usage.mjs` cache path (alphanumeric + `._-`, truncated to 64).

## 10. Doability

**Trivial.** Pure Node `fs.readFileSync` / `fs.writeFileSync`. Already proven at `lib/usage.mjs:24-38`. Works on macOS / Linux / Windows (`os.tmpdir()` handles platform).

## 11. Performance budget

- Cold: +0.5 ms (one stat + one small JSON read).
- Warm: +0.3 ms.
- Write: +0.4 ms (truncate + rewrite, file is small <1 KB).
- No network, no spawn, no locks.

## 12. Reliability & failure modes

- **Tmp file deleted between renders** (tmpreaper, OS reboot): treat as fresh session, no error.
- **Corrupt JSON** (very rare, can happen on interrupted write): catch, rewrite fresh, log to debug log once.
- **Disk full** (edge case): swallow write error, statusline still renders. No feature relies on state being persistent across renders for *correctness* — only for *enrichment*.
- **Concurrent writes within same session** (shouldn't happen per Claude Code event semantics, but): no lock; last-write-wins is safe because all writers share a session id and write equivalent data.

## 13. Config schema

No user config. Internal schema:

```json
{
  "schemaVersion": 1,
  "lastSeen": { "<probe-path>": "<coerced-value>" },
  "counters": {
    "messagesSinceLastChange": { "<probe-path>": <int> },
    "totalRenders": <int>,
    "firstSeenAt": <epoch-ms>,
    "lastRenderAt": <epoch-ms>
  }
}
```

Schema version bump required if fields change; consumer migrates or resets.

## 14. Code integration

**New file:** `lib/state.mjs` (~100 LOC)

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCHEMA_VERSION = 1;

export function statePath(sessionId) {
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
  return join(tmpdir(), `lean-statusline-state-${safe}.json`);
}

export function loadState(sessionId) {
  const p = statePath(sessionId);
  if (!existsSync(p)) return freshState();
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    if (s.schemaVersion !== SCHEMA_VERSION) return freshState();
    return s;
  } catch { return freshState(); }
}

export function saveState(sessionId, state) {
  const p = statePath(sessionId);
  try {
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(p, JSON.stringify(state), 'utf8');
  } catch { /* disk full etc — non-fatal */ }
}

function freshState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    lastSeen: {},
    counters: { messagesSinceLastChange: {}, totalRenders: 0, firstSeenAt: Date.now(), lastRenderAt: Date.now() },
  };
}

// Merge-and-tick — call once per render right before saveState()
export function tickState(state, probes) {
  for (const [key, value] of Object.entries(probes)) {
    const prev = state.lastSeen[key];
    if (prev === value) {
      state.counters.messagesSinceLastChange[key] = (state.counters.messagesSinceLastChange[key] ?? 0) + 1;
    } else {
      state.lastSeen[key] = value;
      state.counters.messagesSinceLastChange[key] = 0;
    }
  }
  state.counters.totalRenders += 1;
  state.counters.lastRenderAt = Date.now();
  return state;
}

export function changedSince(state, key) {
  return (state.counters.messagesSinceLastChange[key] ?? 0) === 0 && state.counters.totalRenders > 1;
}
```

**Edit `bin/lean-statusline.mjs renderFromStdin()`** around line 139:

```js
import { loadState, saveState, tickState } from '../lib/state.mjs';

async function renderFromStdin() {
  // ... existing parse ...
  const state = loadState(input.session_id);
  const ctx = {
    input, cfg, palette, icons, rateLimits,
    state,                                          // ← new
    dangerousPerms, effortLevel, contextPct,
  };
  process.stdout.write(renderLine(ctx));
  tickState(state, {
    'used_percentage': contextPct,
    'version': input.version,
    'agent.name': input.agent?.name ?? null,
    'session_name': input.session_name ?? null,
  });
  saveState(input.session_id, state);
}
```

**Update `lib/doctor.mjs`** to list stale state files and support `--clean`.

## 15. Dependencies

- None. Ship in Wave 0.

## 16. Testing

- **Unit** (`test/state.test.mjs`):
  - Load from nonexistent path returns fresh state.
  - Corrupt JSON returns fresh state without throwing.
  - `tickState` correctly resets counters on value change.
  - `changedSince` returns true only on first render after change.
- **Fixture-based**: simulate 5 renders, assert `messagesSinceLastChange` increments correctly.
- **Concurrency**: spawn two parallel renders with the same `session_id`, ensure neither throws (last-write-wins is acceptable).

## 17. Rollout plan

- Ship in `lean-statusline@1.2.0` alongside defensive-payload-probing.
- No migration: if an old state file predates schema version, rewrite fresh.
- Add a release note about `/tmp/lean-statusline-state-*.json` existence so users on strict tmp-cleanup cron jobs aren't surprised.

## 18. Regression risks

- **Tmp dir on network-mounted filesystem** could slow `fsync` significantly. Mitigation: `writeFileSync` uses default (no `flush: true`), which trusts OS page cache. Accept risk.
- **Many concurrent sessions (>20)** produce many small state files. Mitigation: doctor's lazy GC removes files older than 24h.

## 19. Success metrics

- Zero regressions in existing usage.mjs tests.
- New pace-delta and `max_messages` features work end-to-end in integration tests.
- `doctor` reports <5 state files per user session-hour on average.

## 20. Open questions

- Should state include a digest of `cfg` so config changes invalidate stale counters? Marginal utility; skip for v1.
- Should state survive across `lean-statusline` version upgrades? Yes via schemaVersion check; already in design.
- Cross-machine via `$HOME/.claude/` instead of `/tmp/`? No — session IDs don't portably cross machines and tmp-cleanup is a feature, not a bug.
