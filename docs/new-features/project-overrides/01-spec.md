# Project-pinned overrides (first-match-wins)

**Tier:** S | **Composite:** 9.00 | **Original ID:** #99 (revised per Agent 3) | **Depends on:** —

## 1. What it is

Support a per-repo config at `<workspace.project_dir>/.claude/lean-statusline.json` that **replaces** the user's `~/.claude/lean-statusline.json` when present, *not* deep-merges it. First-match-wins semantics match cship, claude-powerline, and Starship. Enables per-repo taste overrides — e.g. one repo forces `full` preset, another suppresses cost, another adds a custom segment order — without polluting global config.

## 2. Showcase

```
Resolution cascade (top wins)
┌─────────────────────────────────────────────────────────────┐
│  1.  $LEAN_STATUSLINE_CONFIG        (env override)           │
│  2.  <project_dir>/.claude/lean-statusline.json              │  ← new
│  3.  <project_dir>/lean-statusline.config.json               │  ← new (alt name)
│  4.  ~/.claude/lean-statusline.json                          │
│  5.  DEFAULTS (lib/config.mjs)                               │
└─────────────────────────────────────────────────────────────┘

First file found wins — does NOT merge with lower tiers.
The preset inside the chosen file IS deep-merged with DEFAULTS
(for forward-compat with new fields we add later), but cross-file
merging is forbidden.
```

```
Example: monorepo with differing per-app statuslines
  ~/.claude/lean-statusline.json         → compact preset, dots bars
  ~/dev/monorepo/.claude/lean-statusline.json → full preset,
                                                project-pinned conditionals

When Claude Code launches from ~/dev/monorepo, the project file wins.
From any other directory, the user file wins.
```

## 3. Why we need it

- **Teams want per-repo consistency.** A company monorepo might want `full` preset + certain conditionals every engineer sees, without editing each engineer's ~/.claude.
- **Experiments need local scope.** Trying a new preset on one repo shouldn't require saving it globally.
- **Agent 3 evidence:** claude-powerline's deep-merge semantics confused users — `u/jivenossauro` reported Windows newline rendering where a partial override inherited broken state from the parent. First-match-wins avoids this class of bug.
- **Starship precedent.** cship inherits Starship's first-match-wins and it's the single most-praised config ergonomic in cship's Reddit threads.

## 4. Ecosystem examples

- **claude-powerline** — deep-merges user + project files. **This is the footgun.** Agent 3 found 2 user reports of partial-merge surprise.
- **ccstatusline** — no project-level override. Users maintain multiple config profiles manually.
- **cship** — Starship-style first-match-wins. Users love it. Evidence: `docs/research/statusline-conditionals/cship/01-starship-inherited-thresholds-and-format.md`.
- **claudeline** — per-project via file existence check. Same first-match pattern.

## 5. Position on the line

Not a segment. Config-resolution layer in `lib/config.mjs#loadConfig()`.

## 6. How users use it

```bash
# Create a per-repo override (from inside a Claude Code session)
lean-statusline config --init-project-file
# → writes ./.claude/lean-statusline.json seeded with current resolved config

# Inspect which file is active
lean-statusline doctor
# → "active config: /Users/me/dev/monorepo/.claude/lean-statusline.json"
```

## 7. Default mode

**Always on.** File resolution is part of normal `loadConfig()`; users without project files see no change.

## 8. Visualization

None. Doctor surface:

```
lean-statusline doctor

  active config: /Users/me/dev/monorepo/.claude/lean-statusline.json
  cascade (top = active):
    ✓ /Users/me/dev/monorepo/.claude/lean-statusline.json
    ✗ /Users/me/.claude/lean-statusline.json   (shadowed by project file)
    ✗ DEFAULTS                                  (shadowed)
```

## 9. Data source

- `input.workspace.project_dir` from stdin (always present).
- Local filesystem: two possible file paths, checked in order.
- `$LEAN_STATUSLINE_CONFIG` env var (highest priority, preserves existing behavior).

## 10. Doability

**Trivial.** Pure filesystem resolution. Works on macOS, Linux, Windows. No new deps.

## 11. Performance budget

- +0.3 ms (two `existsSync` calls in the common case).
- Zero additional parsing when no project file exists.

## 12. Reliability & failure modes

- **Invalid JSON in project file**: warn, fall back to user config. Don't crash.
- **project_dir absent** (edge case, pre-first-API-call): no project lookup, user config used.
- **Symlinked project dir**: `existsSync` follows symlinks; treat as normal file.
- **Project file schema mismatch** with user's version of lean-statusline: validateConfig catches unknown fields, warns, strips before use.

## 13. Config schema

No new top-level schema. File format is identical to user config.

Convention for seeding:

```json
{
  "$schema": "https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/schema.json",
  "preset": "full",
  "separator": "·",
  "conditionals": {
    "cost": { "hide_when_equals": {} }    // show cost always in this repo
  }
}
```

## 14. Code integration

**Edit `lib/config.mjs`** — extend `CONFIG_PATH` resolution:

```js
// Replace the single CONFIG_PATH constant with a resolve function.
export function resolveConfigPath(input) {
  // 1. env override (preserve existing LEAN_STATUSLINE_CONFIG)
  if (process.env.LEAN_STATUSLINE_CONFIG) return process.env.LEAN_STATUSLINE_CONFIG;

  // 2. project-level files (first-match-wins)
  const projectDir = input?.workspace?.project_dir;
  if (projectDir) {
    const candidates = [
      join(projectDir, '.claude', 'lean-statusline.json'),
      join(projectDir, 'lean-statusline.config.json'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }

  // 3. user-global (existing)
  return join(homedir(), '.claude', 'lean-statusline.json');
}

export function loadConfig(input = {}) {
  const path = resolveConfigPath(input);
  // ... rest unchanged ...
}
```

**Edit `bin/lean-statusline.mjs renderFromStdin()`** to thread `input` through:

```js
const { config } = loadConfig(input);     // was: loadConfig()
```

**Update `lib/doctor.mjs`** to print the resolution cascade.

**Add new command `lean-statusline config --init-project-file`** that writes the current resolved config to `<project_dir>/.claude/lean-statusline.json`.

## 15. Dependencies

- None strictly. Pairs naturally with `conditionals-schema` so users can override just the bits they care about.

## 16. Testing

- **Unit** (`test/config.test.mjs`):
  - Project file present → wins over user file.
  - Project file absent → user file used.
  - Project file malformed → warn, fall back to user.
  - Env var present → wins over both.
  - `project_dir` absent → skip project lookup gracefully.
- **Fixture-based**: temp dir with/without project file, assert correct resolution.

## 17. Rollout plan

- Ship in `@1.4.0`.
- Release notes highlight the new cascade, with a sample `--init-project-file` flow.
- Doctor command updated in same release.

## 18. Regression risks

- **User has both files** and expects merge semantics (from habit with claude-powerline): documented in release notes that this is first-match-wins. Migration guide explains how to port common merge patterns.
- **Project files checked into git** might leak personal preferences to coworkers: docs suggest `.gitignore`ing personal choices; commit only team-chosen settings.

## 19. Success metrics

- Adoption rate of `<project>/.claude/lean-statusline.json` files across public repos measurable via GitHub code search.
- Zero bug reports about "my config was partially merged incorrectly."

## 20. Open questions

- Should we search ancestor directories for a project file (like git's parent-walk)? Maybe — but Claude Code already gives us `project_dir` as an anchor, so no walk needed. Keep simple.
- Should we support TOML as an alternative format for consistency with Starship? Not in v1. Keeps lean-statusline zero-dep.
- Three-tier merge (env > project > user) for a single cascading key? Tempting but the "merge is footgun" evidence is strong. Hold the line on first-match-wins.
