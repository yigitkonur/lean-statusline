# Two-band thresholds

**Tier:** A | **Composite:** 8.15 | **Original ID:** N9 (new from Agent 3 cship evidence) | **Depends on:** —

## 1. What it is

Replace the current single `thresholds.warn / high / crit` triple with a two-band `{warn_at, critical_at}` pair that matches Starship/cship convention. Keeps the third color band (`green` below warn) implicit. Centralizes the color-for-pct logic used across every percent-bearing segment. Simpler config, validated pattern, clean upgrade path.

## 2. Showcase

```
Current (lib/colors.mjs:146-152 colorForPct)
  warn:  50    high:  70    crit:  90
  ──────┬───────────┬──────────────┬──────
  green │ orange    │ yellow       │ red
    0   50          70             90   100

After (this feature)
  warn_at:  70    critical_at: 90
  ──────────────┬────────────────┬──────
  green         │ yellow          │ red
    0           70                90   100

Why two bands beats three:
  • cship's config showcase uses two bands in ALL 7 sample configs (Agent 3)
  • Saves one tuning decision per preset
  • Matches Starship ecosystem — users port configs trivially
  • Third band (green/healthy) is implicit; no colors go unused
```

## 3. Why we need it

- **Current three-band scheme overcomplicates the common case.** Agent 3 observed zero users tuning `warn` separately from `high` across surveyed configs.
- **cship's two-band pair (`warn_threshold`, `critical_threshold`) is validated** across cship's 7 showcase configs (Agent 3 evidence).
- **Paves the way for conditionals-schema's threshold block** which already declares `warn_at` / `critical_at` naming.
- **Simpler config = fewer wrong configs.** Survey evidence (Agent 3) showed partial `thresholds: { high: 80 }` entries in user configs that accidentally reset the other bands to undefined.

## 4. Ecosystem examples

- **cship / Starship** — ubiquitous two-band convention. Evidence: `docs/research/statusline-conditionals/cship/01-starship-inherited-thresholds-and-format.md`.
- **claude-powerline** — single-band `warningThreshold`. Weaker; user can't distinguish "notice" from "critical."
- **ccstatusline** — per-widget thresholds, usually single-band.
- **Two-band is the middle-ground winner.**

## 5. Position on the line

Not a segment. Library-level color function used by every percent segment (`ctx`, `5h`, `7d`, `rate-*-full`, `context-bar`).

## 6. How users use it

```json
{
  "thresholds": {
    "warn_at": 70,
    "critical_at": 90
  }
}
```

Legacy three-band still accepted with deprecation warning:

```json
{ "thresholds": { "warn": 50, "high": 70, "crit": 90 } }
// → warns: "use warn_at + critical_at; old fields mapped to warn_at=70, critical_at=90"
```

## 7. Default mode

**Always on.** It IS the color function.

## 8. Visualization

Per-percent color:
- `< warn_at` → green
- `warn_at ≤ pct < critical_at` → yellow (was "orange" in default palette; we rename semantically)
- `≥ critical_at` → red

Bar color same rule, rail stays dim.

## 9. Data source

- User config / preset → `cfg.thresholds`.
- Per-segment override via conditionals-schema's `threshold` block.

## 10. Doability

**Trivial.** Refactor of `colorForPct` in `lib/colors.mjs`. Add legacy-alias handling in config loader.

## 11. Performance budget

- Zero change. Same two comparisons as current.

## 12. Reliability & failure modes

- **Only `warn_at` set, not `critical_at`**: validator rejects at load time with clear error.
- **`warn_at >= critical_at`**: validator rejects.
- **Out-of-range values**: existing `checkNum` in `validateConfig` already enforces `[0, 100]`.
- **Legacy config migration**: preserved via explicit alias map; users never break.

## 13. Config schema

```jsonc
{
  "thresholds": {
    "warn_at": 70,       // required; must be < critical_at
    "critical_at": 90    // required; must be > warn_at
    // Legacy: warn/high/crit still accepted with deprecation warning
  }
}
```

## 14. Code integration

**Edit `lib/colors.mjs colorForPct()`** (line 146):

```js
export function colorForPct(pct, thresholds, palette) {
  const warnAt = thresholds?.warn_at
              ?? thresholds?.high           // legacy alias
              ?? 70;
  const critAt = thresholds?.critical_at
              ?? thresholds?.crit           // legacy alias
              ?? 90;
  if (pct >= critAt) return palette.red;
  if (pct >= warnAt) return palette.yellow;
  return palette.green;
}
```

**Edit `lib/config.mjs DEFAULTS.thresholds`** (line 62):

```js
thresholds: { warn_at: 70, critical_at: 90 },
```

**Edit `lib/config.mjs validateConfig()`** to accept new field names + warn on legacy:

```js
// Inside validateConfig:
const t = cfg.thresholds ?? {};
const hasNew = 'warn_at' in t || 'critical_at' in t;
const hasLegacy = 'warn' in t || 'high' in t || 'crit' in t;
if (hasLegacy && !hasNew) {
  // Record warning (see lib/config.mjs warning channel)
  cfg.__warnings = cfg.__warnings ?? [];
  cfg.__warnings.push('thresholds.{warn,high,crit} deprecated; rename to warn_at + critical_at');
}
const warnAt = t.warn_at ?? t.high ?? 70;
const critAt = t.critical_at ?? t.crit ?? 90;
if (warnAt >= critAt) errors.push('thresholds.warn_at must be < thresholds.critical_at');
for (const [k, v] of [['warn_at', warnAt], ['critical_at', critAt]]) {
  if (typeof v !== 'number' || v < 0 || v > 100) errors.push(`thresholds.${k} must be 0-100`);
}
```

**Update `lib/presets.mjs`** preset defaults to use new field names.

**Update `lib/doctor.mjs`** to surface deprecation warnings.

## 15. Dependencies

- None strictly. Pairs with conditionals-schema's per-segment `threshold` override (same field names).

## 16. Testing

- **Unit** (`test/colors.test.mjs`):
  - `pct=30, warn_at=70, crit_at=90` → green.
  - `pct=75` → yellow.
  - `pct=95` → red.
  - Legacy `{ warn: 50, high: 70, crit: 90 }` → maps to `{warn_at: 70, crit_at: 90}`.
  - Invalid `warn_at=95, crit_at=90` → validator errors.
- **Migration**: user config with legacy fields round-trips through `lean-statusline config --edit` → saves with new names + preserves semantics.

## 17. Rollout plan

- Ship in `@1.4.0` with conditionals-schema.
- Release notes: deprecation table + one-line migration hint.
- Remove legacy-alias support in `@2.0.0`.

## 18. Regression risks

- **Users who explicitly set `warn=50`** to color mid-range orange: documented transition. Their new `warn_at=50` produces equivalent behavior.
- **Preset authors who hard-coded the three fields**: updated in same PR.
- **Lost third color band** (orange between 50 and 70): intentional simplification. Default palette's orange goes unused for percentages; still used semantically elsewhere (SSH segment).

## 19. Success metrics

- User configs migrated cleanly in >95% of installs.
- Zero confusion reports about missing mid-range color.
- cship users porting configs in seconds (anecdotal).

## 20. Open questions

- Should `warn_at` default to 50 instead of 70 for parity with current "orange starts at 50"? No — Agent 3 evidence shows 70 is the more useful cutoff across shipping configs.
- Allow `colors.mid` as an opt-in third band for users who want it? Plausible follow-up, but not in v1.
- Per-segment overrides (e.g. ctx uses 50/80, 5h uses 70/90): conditionals-schema's `threshold` block already supports this.
