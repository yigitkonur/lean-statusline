# Worktree always-on

**Tier:** S | **Composite:** 9.25 | **Original ID:** #19 | **Depends on:** conditionals-schema

## 1. What it is

Force-pin the `worktree` segment to line 1 (ahead of `dir`) whenever Claude Code reports *any* worktree signal — either the `--worktree` session fields (`worktree.*`) or the generic `workspace.git_worktree`. Override the preset's declared segment order, because worktree context is too operationally important to let a minimalist ordering hide it.

## 2. Showcase

```
Main working tree (not a worktree)
  🔒 mac-mini · Opus 4.7 · ✎ 12% · lean-statusline (main)
                                     ↑ no worktree segment, clean.

Inside a linked worktree — e.g. `git worktree add ../wt-login feat/login`
  🔒 mac-mini · Opus 4.7 · ✎ 12% · 🌿 wt-login · lean-statusline (feat/login) ⇢ from lean-statusline
                                    ↑ forced in front of dir regardless of preset

Inside a --worktree session (worktree.original_branch present)
  🔒 mac-mini · Opus 4.7 · ✎ 12% · 🌿 my-feature ← main · lean-statusline (worktree-my-feature)
                                    ↑ parent branch crumb from worktree.original_branch
```

## 3. Why we need it

- **Worktrees are the #1 context-confusion source** in multi-branch workflows: users forget which worktree a session belongs to and run tests/commits against the wrong tree.
- **Claude Code ships the signal** (`worktree.*` during `--worktree` sessions, `workspace.git_worktree` otherwise). Using it is free.
- **Preset authors shouldn't have to remember** to slot `worktree` into every preset. The segment self-elevates when triggered.
- **Nobody in the ecosystem does this.** ccstatusline and claude-powerline require the user to manually add the worktree widget; `compact` users miss it.

## 4. Ecosystem examples

- **claude-powerline** — has a worktree segment but users must manually enable.
- **ccstatusline** — same (optional widget).
- **cship** — inherits Starship's worktree module, manual format string.
- **claudeline, claude-hud** — don't surface worktrees explicitly.
- **Lean-statusline wins on the "always on when present" ethos** that matches what the SSH segment already does in every preset.

## 5. Position on the line

Dynamic — slots in **immediately before `dir`** when worktree is active, regardless of the preset's declared order. If preset already places `worktree` somewhere else, that original slot is suppressed to avoid duplication.

## 6. How users use it

Default-on. Silence with:

```json
{ "show": { "worktree": false } }
```

Or explicitly include in preset (traditional ordering, overriding the auto-elevation):

```json
{ "segments": ["ssh", "model", "ctx", "worktree", "dir", ...] }
```

## 7. Default mode

**Always on** when any of these are true:
1. `input.worktree.name` is present (`--worktree` session)
2. `input.workspace.git_worktree` is present (cwd inside a linked worktree)

## 8. Visualization

- Unicode: `🌿 <name>` in cyan; if `worktree.original_branch` present, append ` ← <original>` in dim.
- ASCII: `wt <name>` with ` <- <original>` suffix.
- Width: ~8–30 chars. Width-adaptive-layout drops the `← <original>` suffix at <100 cols, then the whole segment at <76 cols.

## 9. Data source

- `input.worktree.name` (present only in `--worktree`).
- `input.worktree.original_branch` (may be absent for hook-based worktrees).
- `input.workspace.git_worktree` (present whenever cwd is inside a linked worktree, per docs).

Priority: `worktree.name` > `workspace.git_worktree`.

## 10. Doability

**Trivial.** Three field probes, one conditional auto-elevation. No I/O.

## 11. Performance budget

- <0.1 ms including the slot-reorder.
- No disk, no spawn.

## 12. Reliability & failure modes

- **`worktree.branch` vs `git branch --show-current` disagree**: don't care — we trust the payload, no spawn.
- **Hook-based worktree with absent `original_branch`**: crumb omitted, name still shows.
- **User forgot they're in a worktree**: that's literally what this feature catches; no failure mode.

## 13. Config schema

```json
{
  "show": { "worktree": true },
  "conditionals": {
    "worktree": {
      "requires": [],
      "hide_when_equals": {}
    }
  }
}
```

The `requires` is empty because we check 3 fields manually (any-of logic); conditionals `requires` is all-of.

## 14. Code integration

**Edit `lib/segments.mjs` worktree(ctx)`** around line 384:

```js
worktree(ctx) {
  const name = probe('worktree.name', ctx.input)
            ?? probe('workspace.git_worktree', ctx.input);
  if (name === UNSET || !name) return null;
  const orig = probe('worktree.original_branch', ctx.input);
  const origStr = (orig && orig !== UNSET)
    ? ` ${ctx.palette.dim(ctx.icons.ssh === 'SSH' ? '<-' : '←')} ${ctx.palette.dim(orig)}`
    : '';
  return `${ctx.palette.dim(ctx.icons.worktree)} ${ctx.palette.cyan(name)}${origStr}`;
}
```

**Edit `lib/segments.mjs renderLine()`** to auto-elevate:

```js
export function renderLine(ctx) {
  // Auto-elevate worktree: if active but not in the declared segments,
  // prepend it before 'dir'. Also de-dupe if already declared.
  let segs = ctx.cfg.segments.slice();
  const wtActive = !!(ctx.input?.worktree?.name || ctx.input?.workspace?.git_worktree);
  if (wtActive && ctx.cfg.show.worktree !== false) {
    const wtIdx = segs.indexOf('worktree');
    if (wtIdx >= 0) segs.splice(wtIdx, 1);                // remove existing
    const dirIdx = segs.indexOf('dir');
    const insertAt = dirIdx >= 0 ? dirIdx : segs.length;  // before dir, or end
    segs.splice(insertAt, 0, 'worktree');
  }
  // ... rest uses `segs` instead of `ctx.cfg.segments` ...
}
```

**Update `lib/config.mjs` DEFAULTS.show`** to include `worktree: true`.

## 15. Dependencies

- `defensive-payload-probing` for field probes.
- `conditionals-schema` for the standard gate path (though this feature has custom or-logic).

## 16. Testing

- **Unit** (`test/segments.test.mjs`):
  - No worktree signal → segment absent.
  - `worktree.name` only → segment present, no parent crumb.
  - `worktree.name + original_branch` → segment with `← <orig>`.
  - `workspace.git_worktree` only → segment present.
  - Preset declares `worktree` explicitly → one instance rendered (no dup).
  - `show.worktree = false` → segment always absent.
- **Snapshot** across all three presets × worktree/no-worktree.

## 17. Rollout plan

- Ship in `lean-statusline@1.4.0` with conditionals.
- Release notes highlight "worktree context always surfaces — no more accidental wrong-tree commits."

## 18. Regression risks

- **Preset authors who relied on worktree NOT showing in minimal**: documented in release notes. `show.worktree = false` opts out.
- **Segment ordering changes** could surprise users with tight custom preset layouts. Mitigation: if user declared `worktree` in their own segments array explicitly, respect that position (the code already de-dups).

## 19. Success metrics

- `minimal` and `compact` presets gain worktree visibility for affected users with zero config.
- Support chatter about "wrong-branch test failures" during worktree sessions drops.

## 20. Open questions

- Auto-elevate to line 1 (before `ssh` even)? No — SSH is a more urgent signal (remote machine). Worktree slots just before dir.
- Show worktree path in a tooltip-like OSC 8 hyperlink? Only if OSC 8 ever works reliably (research says no for statusline).
- Multi-worktree sessions (user has 3 linked worktrees, is in one): segment shows the active one's name. Not showing siblings — that's `git worktree list` territory.
