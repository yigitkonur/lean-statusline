# Width-adaptive layout with drop order

**Tier:** A | **Composite:** 8.55 | **Original ID:** #2 merged with N3 | **Depends on:** defensive-payload-probing

## 1. What it is

A four-tier ladder (≥150 / 100–149 / 76–99 / <76 cols) that progressively drops segments using a declarative priority list. Uses the **undocumented `terminal.columns` payload field** shipped in Claude Code 2.1.x (issue #41512, Agent 4), falling back to `$COLUMNS` then `$LINES` env vars, then to a conservative 100-col default. Each preset declares its drop order once; the render layer enforces the ladder automatically.

## 2. Showcase

```
                    4-tier width ladder
┌───────────────────────────────────────────────────────────────────────┐
│ XL (≥150 cols)                                                         │
│   🔒 box · Opus 4.7 (1M) · ✎ 14% · repo (main) ⇢ from mono · 🌿 wt-a ← │
│   current ●●●●○○○○○○ 40% ⇡+14 (in 2h14m) · weekly ●●○○○○○○○○ 22% (4d) │
│                                                                        │
│ L (100–149 cols) — drops 7d bar glyphs, keeps countdowns              │
│   🔒 box · Opus 4.7 · ✎ 14% · repo (main) · 🌿 wt-a                    │
│   current ●●●●○○○○○○ 40% ⇡+14 (in 2h14m) · 7d 22% (4d)                 │
│                                                                        │
│ M (76–99 cols) — drops 7d countdown, pace deltas, project crumb       │
│   🔒 box · Opus 4.7 · ✎ 14% · repo (main) · 🌿 wt-a                    │
│   current ●●●●○○○○○○ 40% (2h)                                          │
│                                                                        │
│ S (<76 cols) — drops 7d entirely; 5h pct always last to go            │
│   🔒 box · Opus · ✎ 14% · repo · 5h 40%                                │
└───────────────────────────────────────────────────────────────────────┘

Drop order (research from Agent 2 + 4, verified across isaacaudet):
  7d bar glyphs → 7d countdown → pace delta → 7d label →
  5h countdown → 5h pace → 5h percent always last
```

## 3. Why we need it

- **Users routinely run Claude Code in split-pane tmux at <100 cols.** Research (Agent 3 Reddit threads) documents frustration with statuslines that overflow into the next line or get truncated by Claude Code's notification area.
- **Agent 4 confirmed `terminal.columns` ships in stdin now** — unblocking this feature which was D-tier in my original evaluation due to `process.stdout.columns` not being a TTY.
- **No shipping tool does 4-tier drop.** ccstatusline has "compact mode" toggles (manual). claude-powerline has fixed widgets. The ladder is our differentiator.
- **Agent 2's evidence** (`docs/research/rate-limit-pace/`) shows the drop-order priority *specifically* — 5h pct is the most-missed-when-absent signal across three communities' polls.

## 4. Ecosystem examples

- **isaacaudet** (shell statusline) — ships a 4-tier width ladder with the exact drop order we adopt. Evidence: `docs/research/rate-limit-pace/isaacaudet/01-adaptive-width-ladder.md`.
- **starship** — inherits its format to cship via module disables, but cship user must hand-declare thresholds.
- **Claude Code itself** — truncates statusline on narrow terminals, which is worse than graceful degradation.

## 5. Position on the line

Not a segment — a render-time filter. Runs after all segments render, drops from right-to-left per the priority list until the joined line fits.

## 6. How users use it

Default-on. Tune:

```json
{
  "layout": {
    "tiers": { "xl": 150, "l": 100, "m": 76, "s": 0 },
    "dropOrder": [
      "7d.bar",       // the bar glyphs, not the 7d segment itself
      "7d.countdown",
      "paceDelta",
      "7d.label",
      "5h.countdown",
      "5h.pace",
      "projectDirCrumb",
      "lines",
      "cost"
      // 5h.percent always last (never dropped — implicit floor)
    ]
  }
}
```

## 7. Default mode

**Always on** with the default drop order above. Users can override per-preset or per-repo.

## 8. Visualization

None directly — effect is on *other* segments' visibility. Debug mode logs:

```
lean-statusline: width=82 → tier M → dropped: 7d.bar, 7d.countdown, paceDelta
```

## 9. Data source

Priority chain:
1. `input.terminal.columns` (undocumented, shipped per Agent 4 #41512).
2. `$COLUMNS` env var.
3. `$LINES` env var (rare, diagnostic).
4. Default 100.

## 10. Doability

**Now viable** because Agent 4 documented that `terminal.columns` ships. Previously this idea was D-tier because stdout-is-pipe defeated `process.stdout.columns`. One probe restores feasibility.

## 11. Performance budget

- +0.3 ms: one probe, one tier lookup, one render + string-length pass, up to K drops where K = list size.
- Worst case re-renders the line partially K times; bounded by `dropOrder.length` (≤10 in practice).

## 12. Reliability & failure modes

- **`terminal.columns` absent** on older Claude Code: fallback to env, then 100-default.
- **ANSI escape codes** in segment output inflate `.length` by ~5–10x. Strip ANSI before length check (`stripAnsi(str).length`).
- **Emoji double-width**: use a lightweight width calculator (string-width behavior) — but avoid the `string-width` dep. Implement a small ruleset: zero for combining marks, 2 for most emoji + CJK, 1 otherwise.
- **User declared a non-existent drop key**: warn, skip.

## 13. Config schema

```json
{
  "layout": {
    "tiers": { "xl": 150, "l": 100, "m": 76, "s": 0 },
    "dropOrder": ["7d.bar", "7d.countdown", "paceDelta", "7d.label", "5h.countdown", "5h.pace", "projectDirCrumb", "lines", "cost"],
    "forceMinWidth": null
  }
}
```

## 14. Code integration

**New file:** `lib/layout.mjs` (~120 LOC)

```js
import { probe } from './probe.mjs';

const DEFAULT_ORDER = [
  '7d.bar', '7d.countdown', 'paceDelta', '7d.label',
  '5h.countdown', '5h.pace', 'projectDirCrumb', 'lines', 'cost',
];

export function resolveWidth(ctx) {
  const fromPayload = probe('terminal.columns', ctx.input);
  if (fromPayload !== UNSET && Number.isFinite(fromPayload)) return fromPayload;
  const fromEnv = Number(process.env.COLUMNS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 100;   // conservative default
}

export function tierFor(width, tiers = { xl: 150, l: 100, m: 76, s: 0 }) {
  if (width >= tiers.xl) return 'xl';
  if (width >= tiers.l)  return 'l';
  if (width >= tiers.m)  return 'm';
  return 's';
}

// Apply drops until the joined line fits. Returns the adjusted ctx
// with segment render flags marked for suppression.
export function applyLayout(ctx, rendered /* string */, width) {
  if (stripAnsi(rendered).split('\n').every(l => l.length <= width)) return rendered;

  const order = ctx.cfg.layout?.dropOrder ?? DEFAULT_ORDER;
  const dropped = new Set();
  let current = rendered;

  for (const key of order) {
    dropped.add(key);
    current = stripByKey(current, key);
    if (stripAnsi(current).split('\n').every(l => l.length <= width)) break;
  }
  return current;
}

function stripAnsi(s) {
  // Small inline ANSI stripper — matches CSI and OSC sequences.
  return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\]8;;[^\x07]*\x07/g, '');
}

function stripByKey(line, key) {
  // Each segment render tags itself with an invisible marker we can strip.
  // Tags look like \x1e<key>\x1f ... content ... \x1e/<key>\x1f
  // (both chars are 0-width control chars Claude Code renders as nothing).
  const rx = new RegExp(`\\x1e${key}\\x1f[\\s\\S]*?\\x1e/${key}\\x1f`, 'g');
  return line.replace(rx, '');
}
```

**Edit every segment** that participates in the drop order to wrap its output:

```js
// Example — 7d segment drops its bar glyphs specifically:
'7d'(ctx) {
  const lim = ctx.rateLimits?.sevenDay;
  if (lim?.pct == null) return null;
  const barTag = `\x1e7d.bar\x1f${buildBar(...)}\x1e/7d.bar\x1f`;
  const pctTag = `\x1e7d.percent\x1f${color(`${lim.pct}%`)}\x1e/7d.percent\x1f`;
  return `${ctx.palette.dim('7d')} ${barTag} ${pctTag}`;
}
```

**Edit `bin/lean-statusline.mjs renderFromStdin()`** to pipe the rendered line through `applyLayout`:

```js
import { resolveWidth, applyLayout } from '../lib/layout.mjs';

const width = resolveWidth({ input, cfg });
const rendered = renderLine(ctx);
const final = applyLayout({ cfg }, rendered, width);
process.stdout.write(final);
```

## 15. Dependencies

- `defensive-payload-probing` for `terminal.columns`.
- Every segment that participates needs to tag its output; coordinate in same PR as conditionals-schema.

## 16. Testing

- **Unit** (`test/layout.test.mjs`):
  - width = 200 → no drops.
  - width = 82 → drops through tier M's list.
  - width = 60 → drops until 5h percent alone remains.
  - ANSI-escape handling: 100-char line with 80 chars of color codes fits 50-col terminal.
  - Emoji width: line with 🔒 and 🤖 measured correctly.
- **Snapshot**: render each preset at widths 200, 120, 90, 60.

## 17. Rollout plan

- Ship in `@1.6.0` after width-probing and tag-based stripping are implemented.
- Release note: "lean-statusline now adapts to narrow terminals automatically."

## 18. Regression risks

- **Tag-based markers leak through** if stripping fails: user sees `\x1e7d.bar\x1f` bytes. Mitigation: always strip all tags at the end, even after successful drops.
- **ANSI stripping misses an escape form**: width calculation off. Add unit-fuzz tests with realistic segment output.
- **User override drops in wrong order** (e.g. wants 5h pace preserved but 7d pct gone): first-match-wins config allows full override.

## 19. Success metrics

- 3-line `full` preset no longer wraps on 100-col terminals.
- No user complaints about truncation at widths ≥76.
- Doctor's `--layout` subcommand shows the tier + drop set for the current terminal.

## 20. Open questions

- Should we also adapt vertical (drop lines when `terminal.rows < 3`)? Probably — add in same feature PR.
- Per-preset tier defaults (full presets get looser M-tier because they have more to work with)? Defer to user feedback.
- Auto-downgrade preset entirely (fall back compact → minimal when width <60)? Interesting but surprising; keep behavior predictable.
