# workspace.project_dir drift crumb

**Tier:** S | **Composite:** 9.25 | **Original ID:** #4 | **Depends on:** conditionals-schema

## 1. What it is

When Claude Code's working directory (`workspace.current_dir`) differs from the directory the session was launched in (`workspace.project_dir`), append a small `⇢ <basename>` crumb to the `dir` segment. Silent whenever they match (the common case). Tells the user "you're not where you started" without requiring a `pwd`.

## 2. Showcase

```
current_dir == project_dir   (99% case)
  lean-statusline (main)

current_dir moved deeper:
  /Users/me/dev/monorepo/packages/auth
  project_dir was /Users/me/dev/monorepo
  ──────────────────────────────────────
  auth (feat/login) ⇢ from monorepo

Moved to a sibling/unrelated dir:
  /tmp/scratch
  project_dir was /Users/me/dev/monorepo
  ──────────────────────────────────────
  scratch ⇢ from monorepo   ← still shows origin
```

## 3. Why we need it

- **`cd` inside a session silently changes the working directory** but keeps the same session context. Users often forget.
- **`workspace.project_dir` is documented + always present.** Free signal, zero cost.
- **Every shell-statusline I reviewed ignores this field.** Zero prior art = differentiator.
- **Concrete footgun prevented:** running tests, file edits, or Git operations against the "wrong" repo when Claude Code drifted out of the launch dir.

## 4. Ecosystem examples

- **ccstatusline, claude-powerline, cship, claudeline, claude-hud** — none surface `project_dir` at all. Feature exclusive.
- **Shell prompts** (Starship, p10k) show only current dir; they have no concept of "session launch dir."
- **This is where lean-statusline can teach the pattern.**

## 5. Position on the line

Inline with the existing `dir` segment, appended after the branch:

```
lean-statusline (main) ⇢ from monorepo
```

Same line, same color palette. No new segment needed.

## 6. How users use it

Default-on in all presets. Toggle:

```json
{
  "show": { "projectDirCrumb": false }
}
```

## 7. Default mode

**Always on** when `workspace.current_dir !== workspace.project_dir`. Silent otherwise.

## 8. Visualization

- Unicode: `⇢ from <basename>` in dim cyan.
- ASCII fallback: `<- from <basename>`.
- Width: ~12–25 chars depending on basename. Width-adaptive-layout drops this first on <100 col terminals.

## 9. Data source

- `input.workspace.current_dir` (always present)
- `input.workspace.project_dir` (always present)

Both are top-level documented fields.

## 10. Doability

**Trivial.** One string compare plus a basename extract. No I/O.

## 11. Performance budget

- <0.05 ms (one strcmp + one substring).
- Zero allocations in the equal-path.

## 12. Reliability & failure modes

- **Either field absent** (shouldn't happen but): conditionals `requires` gates the crumb. Fail-silent.
- **Paths use different path separators** (Windows mixed drive letters): normalize both with `node:path` before compare.
- **Symlink resolution differs** between fields (edge case): still shows crumb; not harmful, just informative. Don't over-engineer.

## 13. Config schema

```json
{
  "show": { "projectDirCrumb": true },
  "conditionals": {
    "dir": {
      "requires": ["workspace.current_dir", "workspace.project_dir"]
    }
  }
}
```

## 14. Code integration

**Edit `lib/segments.mjs dir(ctx)`** around line 252:

```js
dir(ctx) {
  const cwd = probe('workspace.current_dir', ctx.input) || process.cwd();
  const proj = probe('workspace.project_dir', ctx.input);
  const name = formatDir(cwd, ctx.cfg.dirStyle);
  const zap = (ctx.cfg.show.zap && ctx.dangerousPerms)
    ? `${ctx.palette.red(ctx.icons.zap)} ` : '';
  let out = `${zap}${ctx.palette.cyan(name)}`;

  if (ctx.cfg.show.branch) {
    const { branch, dirty } = gitState(cwd);
    if (branch) {
      // ... existing branch formatting ...
      out += ` ${body}`;
    }
  }

  // ↓ new — project_dir drift crumb
  if (ctx.cfg.show.projectDirCrumb !== false && proj && cwd !== proj) {
    const parentName = proj.split(/[/\\]/).filter(Boolean).pop();
    const arrow = ctx.icons.ssh === 'SSH' ? '<-' : '⇢';
    out += ` ${ctx.palette.dim(`${arrow} from ${parentName}`)}`;
  }

  return out;
}
```

**Update `lib/config.mjs` DEFAULTS.show`** to include `projectDirCrumb: true`.

## 15. Dependencies

- `defensive-payload-probing` for the `probe()` calls.
- `conditionals-schema` for the optional hide-below gate.

## 16. Testing

- **Unit** (`test/segments.test.mjs`):
  - Same paths → no crumb.
  - Deeper cwd → crumb shows basename of project_dir.
  - Unrelated cwd (`/tmp/scratch` vs `/Users/me/repo`) → crumb shows basename.
  - Either field missing → no crumb.
  - ASCII mode → `<-` glyph.

## 17. Rollout plan

- Ship in `lean-statusline@1.4.0` with conditionals-schema.
- Default-on in all three presets.

## 18. Regression risks

- **Users who routinely `cd` away and find the crumb noisy**: disabled via `show.projectDirCrumb = false`.
- **Terminal truncation** on narrow terminals: width-adaptive-layout handles it.

## 19. Success metrics

- Support inquiries "why is my tool running in the wrong place?" → 0 (anecdotal, hard to measure).
- No regression reported across top 3 presets in smoke tests.

## 20. Open questions

- Show the full relative path instead of just a basename? (`⇢ packages/auth from monorepo`)? Tempting but long. Defer.
- Color the crumb red when cwd is OUTSIDE project_dir entirely? Good idea; add as a follow-up.
