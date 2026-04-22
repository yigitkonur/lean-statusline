# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.3] — 2026-04-21

### Changed
- **`DEFAULTS.show.worktree` flipped from true to false.** Worktree auto-elevation (inserting `🌿 <name>` before `dir` whenever worktree data is present) ran on every install by default, which made the wizard preview always show a worktree row even for users who never opted in. Users who want the auto-elevation toggle `show.worktree` on via wizard page 4.

### Fixed
- **One-shot migration for pre-1.5.3 saved configs.** `normalizeConfig` now stamps `_configVersion` on load. When a config is on a known preset (`minimal`/`compact`/`full`) AND still contains the old preset-shipped `ssh` segment, 1.5.3 resets the three fields whose defaults changed: strips `ssh` from `segments`, flips `show.worktree` and `show.branch` to `false`. The linkage on ssh-presence avoids clobbering intentional choices — a user who removed ssh but kept `show.worktree: true` explicitly keeps it. Each reset emits a one-line warning so users understand the change. The 1.5.2 preset template edits meant new installs already got the new defaults; this migration catches existing users too.

## [1.5.2] — 2026-04-21

### Changed
- **`ssh` off by default across every preset.** `minimal`, `compact`, `full`, and `DEFAULTS.segments` no longer include `ssh`. Most sessions are local, and the wizard preview showing `🔒 preview-host.local.dev` on page 1 before the user reached the SSH toggle was confusing. Users who want the remote-host prefix turn `ssh` on via wizard page 4 (core segments) — the inline example column now makes that toggle self-documenting. Existing saved configs with `ssh` already in `segments` keep working unchanged.
- **Wizard preview keeps `current` and `weekly` on the same line when the preset groups them there.** Reverted the 1.5.1 `splitRateBarLine()` helper that forced them onto separate preview rows. The `layout.dropOrder = []` override still prevents `weekly` from silently dropping when the line overflows — per-line ellipsis truncation handles true overflow with a trailing `…`. Preview now mirrors the real statusline's layout exactly.

## [1.5.1] — 2026-04-21

### Added
- **Inline rendered examples beside every wizard toggle.** A new `SEGMENT_EXAMPLE` / `ENUM_EXAMPLE` builder produces palette-accurate samples for all 19 core/optional segments (`🔒 preview-host`, `◐ high`, `🌿 feat-branch`, `+156 -23`, …) plus the 4 high-signal enums (`hostnameStyle`, `modelFormat`, `dirStyle`, `show.ctxLabel`). Shown in a dedicated column on every row — always visible, dimmed when the segment is off — so toggling produces a visible change even when the main preview drops the segment due to width. Rebuild is cached on `palette|colors|icons|barStyle` so navigation stays fast.

### Fixed
- **SSH host line no longer renders in preview when `ssh` is toggled off.** The preview forced `LEAN_STATUSLINE_SSH_HOST=preview-host.local.dev` unconditionally on every page; now gated on `state.segments.includes('ssh')`. Toggle flips → preview reflects it instantly.
- **Weekly rate row now stays visible at any bar width.** Preview-only cfg clears `layout.dropOrder` so `7d.*` keys never silently drop, and a new `splitRateBarLine()` helper injects `\n` between `rate-5h-full` and `rate-7d-full` when both share a line. Each rate bar gets its own preview row regardless of `rateBarWidth`. Real-runtime layout is untouched — production configs still collapse both bars onto one line when they fit.
- **Catppuccin Latte labels readable on dark terminals.** `white` slot remapped `#4c4f69` → `#acb0be` (Latte's `subtext1`). The prior value was designed for light-theme terminal backgrounds; Claude Code terminals skew dark, so `current`/`weekly`/`context` labels rendered nearly invisible.
- **Wizard page 5 fits on 24-row terminals.** On page 5 only, the preview is sliced to the first line and the `conditionalPreviewNote` footer is suppressed, recovering ~5 rows so the 12 optional toggles + 3 formatting fields no longer clip under the fold. The inline examples (above) mean users don't lose any feedback about what their choices look like.

## [1.5.0] — 2026-04-21

### Added
- **Ellipsis truncation in layout.** Overly long lines that survive the drop-ladder now terminate with a trailing `…` at `previewWidth` rather than wrapping or silently overflowing. Visible in both the real statusline and the wizard preview.
- **`show.ctxLabel` enum.** Three explicit styles for the `ctx` header: `text` (`context 32%`, new default), `icon` (legacy `✎ 32%`), `none` (`32%`). Replaces the binary "show ctx label" bool.

### Changed
- **Wizard reduced to 5 pages** (was 6): preset · layout · appearance · core segments · optional features. Each page fits in 24 rows on standard terminals.
- **Palette list trimmed from 17 → 6** hand-picked entries: solarized, rose-pine, catppuccin, catppuccin-latte, dracula, monochrome. Dropped entries (default, nord, tokyo-night\*, kanagawa\*, one-dark, gruvbox, ayu-\*, solarized-light, rose-pine-moon/dawn, catppuccin-frappe/macchiato) still documented under `docs/research/palettes/` and auto-migrated via `PALETTE_ALIASES` in `loadConfig` so saved configs keep loading.
- **Bar styles trimmed 11 → 7**, reordered with `lanterns` as #2 per user pref: dots (default), lanterns, blocks, ascii, squares, bricks, lines. Dropped styles (braille, hearts, arrows, triangles) alias onto `dots` via `BAR_STYLE_ALIASES`.
- **Config schema simplified.** Removed `costPrecision`, `compactNumbers`, `branchStyle`, `branchMaxLen`, `ctxBarWidth`, `show.zap`, `show.bars`. Saved configs referencing them load with a non-fatal deprecation warning. `refreshInterval` upper bound lifted 60 → 3600 so `300` (5 min) validates.
- **Rate-limit dedup.** When both the compact (`5h`/`7d`) and full (`rate-5h-full`/`rate-7d-full`) form are listed, only the full form renders — fixes a duplicate-row bug when users toggled both in the wizard. Standalone compact still works.

## [1.3.2] — 2026-04-21

### Fixed
- **Wizard segment toggle no longer breaks line layout.** Toggling `context-bar` (or any segment that belongs on a later line) OFF and back ON used to drop it onto the first line next to the header, producing an ugly inline `ssh · model · ctx · context ●●●…` row. Root cause: `insertAtCanonicalPosition` used `KNOWN_SEGMENTS` (no `\n` markers) to decide placement; rewrote it to use the active preset's segment list as the source of truth for line structure. Also added `collapseNewlines()` on remove so orphan `\n`s don't leave ghost blank rows.
- **CI publish workflow.** `actions/setup-node`'s placeholder `.npmrc` rejected the granular access token (1.3.1 CI run 404'd on PUT). Workflow now writes `.npmrc` directly from the `NPM_TOKEN` secret — the exact format that works for local `npm publish` — and drops the `NODE_AUTH_TOKEN` env var since `.npmrc` is fully self-contained.

### Changed
- **Wizard preview now mocks every silent-when-absent segment.** Adding fake data for `agent.name`, `vim.mode`, `session_name`, `output_style.name` (set to `'explanatory'` so it's non-default), `worktree.name`, `exceeds_200k_tokens`, `subagents`, plus forcing `dangerousPerms: true` and `LEAN_STATUSLINE_SSH_HOST=preview-host` during preview rendering so users see a visible ON/OFF diff regardless of the local machine's environment. Real renders still go silent when CC doesn't send the field.
- **All segments are togglable in the wizard.** Removed the `LOCKED_SEGMENTS` hard-lock on `ctx`/`5h`/`7d`/`rate-*-full`. The help text still flags them as the primary signals you probably want, but the user can now uncheck them from the wizard UI instead of needing to hand-edit `lean-statusline.json`.

## [1.3.1] — 2026-04-21

### Added
- **Silent auto-update on render.** The render path now polls npm for a newer `lean-statusline` (same cache/TTL model as the CC update check) and, when one is available, detaches `npm install -g lean-statusline@latest` in the background — throttled to once per 24h via a lock file. Next render picks up the new code. Opt out with `autoUpdate: false` in config, or set `LEAN_STATUSLINE_NO_AUTOUPDATE=1` for a one-shot override. Silently no-ops when the user lacks write access to the global prefix.
- **Install-time auto-upgrade.** `lean-statusline install` now runs `selfupdate` first when a newer version is on npm, so re-running install always lands the latest code.
- **Tag-triggered release workflow.** New `.github/workflows/release.yml` — push `vX.Y.Z` and CI runs tests, verifies `tag == package.json#version`, publishes to npm using `NPM_TOKEN`, and creates a GitHub release with auto-generated notes. Supports `workflow_dispatch` with a `dry_run` toggle.

### Removed
- **`bypass-banner` removed from `full` preset defaults.** Claude Code 2.x renders its own `▶▶ bypass permissions on · N shells` chrome directly below the statusline, so our duplicate banner was redundant noise. The segment definition stays — users on older CC versions can opt it back in by editing `~/.claude/lean-statusline.json#segments`.

## [1.3.0] — 2026-04-21

### Added
- **Defensive render-state plumbing.** New `probe`, `state`, and `transcript` internals let renders read unstable payload shapes safely, persist per-session state, and resume transcript reducers incrementally between renders.
- **Project-aware configuration + new feature blocks.** Added project-local config resolution (`lean-statusline config --init-project-file`), `conditionals`, `pace`, `subagents`, `transcript`, and `layout` config blocks, plus `doctor --clean` for pruning stale session-state files.
- **New statusline signals.** Added the `subagents` segment, transcript-backed subagent fallback, project-dir drift crumbs, worktree auto-elevation, and width-aware layout dropping for narrow terminals.
- **Context-size token badge on context-bar.** The full-width bar shows a `Nk` dim-grey badge at the right edge, computed from `used_percentage × context_window_size` (raw float) so it matches `/context` exactly. Includes the boilerplate baseline (system prompt, tools, memory, skills) from the first API call — not per-message totals that would show `0k` after a short turn. Toggle via `show.contextTokens`.
- **CC update notification.** When a newer `@anthropic-ai/claude-code` is published on npm, a `update avail 2.x.y` notice appears on the context-bar row to the left of the token badge. Check runs at most once per hour in a detached background process — never blocks the render. Failed fetches (offline, registry unreachable) are TTL-throttled too: the cache is stamped at spawn time, not only at success, so we don't respawn a detached process on every render. Opt out via `show.ccUpdate: false` or `LEAN_STATUSLINE_NO_NETWORK=1`.
- **`subagentStatusLine` renderer** (`lean-statusline-subagents` bin). A second entry point that CC invokes per-subagent to replace the default row. Shows: status icon (●/✓/✗/⏸ in unicode; `*`/`v`/`x`/`=` in ascii) + name + token count (Nk tok) + elapsed time. The install flow now writes the matching `subagentStatusLine` block into `~/.claude/settings.json` automatically (paired with `statusLine`), and `uninstall` clears both. Respects your palette, barStyle, and icons settings.
- **Pace: inline ETA on 5h + transient urgency explainer.** The abstract `⇡+N` delta on the `current` row is replaced with a concrete `(in 3h35m vs est: 2h11m)` estimate when the window will exhaust before reset. The est is color-graded in 3 tiers — red when < `pace.etaCriticalMs` (1h), orange when < `pace.etaWarnMs` (4h), else yellow. A transient `pace-explainer` row teaches what `vs est:` means for 10 seconds when urgency activates, re-appears every 10 min while urgent, with trend-aware copy (`At this pace …` → `Pace sped up / easing / holding …`) driven by the prior render's ETA via `ctx.state.lastSeen`. `pace.mode: 'eta'` is the new default; `'delta'` keeps the legacy `⇡+N`; `'off'` hides both. 7d row is unchanged. `LEAN_STATUSLINE_PACE_PREVIEW=1` forces the display on for wizard demos.
- **Layout drop-ladder entries for `ccUpdate` and `contextTokens`.** The update notice and token badge are now tag-wrapped so narrow terminals can trim them before the context-bar row overflows.
- **`syncSettingsRefreshInterval` helper** in `lib/install.mjs`. Preset switches (`config --preset full`) now update the `refreshInterval` in `~/.claude/settings.json` without rewriting the statusLine command, so CC picks up the new cadence without requiring a re-install.

### Changed
- **Context % now uses `used_percentage` as primary source.** The header `ctx` segment and the context-bar token badge now share the same priority order — `used_percentage` first (matches `/context`, no autocompact buffer), `remaining_percentage` as fallback, then local math from `current_usage`. No multipliers; Anthropic's numbers are authoritative.
- **`ctx` header segment is text-only.** Dropped the inline bubble bar (rendered the same signal as the full-width `context-bar` row); kept the color-graded `%` text. `ctxBarWidth` is now a deprecated no-op — removed from the wizard but kept in validated defaults so existing saved configs don't error.
- **`full` preset slimmed.** Dropped `cost`, `lines`, and `elapsed` from the default segments — niche for most users. Re-add them by editing `~/.claude/lean-statusline.json#segments`. `contextBarWidth` reduced from 75 → 60 so the bar row doesn't visually dominate the statusline.
- **`full` preset now sets `refreshInterval: 5`.** Rate-limit countdown timers stay visually live during idle sessions (while subagents run in the background). Research shows 5s is optimal: `resets_at` math is client-side, so sub-5s adds no accuracy, and rates only change on API calls anyway.
- **Rate-limit rendering is more informative.** `5h`, `7d`, `rate-5h-full`, and `rate-7d-full` now compute pace deltas, collapse countdowns near reset, and use the new `warn_at` / `critical_at` threshold names while still accepting legacy aliases with warnings.
- **Noise filtering moved into conditionals.** Default agent names, zero-cost/zero-line values, and other low-signal cases are now suppressed centrally instead of inside individual segments.
- **Compact/full presets surface more session context.** Worktree/subagent signals can render automatically, transcript reduction is enabled only where it pays off, and the layout ladder trims tagged fragments before lines overflow.

### Removed
- **`cc-update` segment registration.** Was in `KNOWN_SEGMENTS` but had no renderer — the update notice is inline on `context-bar`, not a separate segment. Removing the dead entry prevents users selecting a silent segment via the wizard.

## [1.2.0] — 2026-04-18

### Added
- **Color palettes.** New `palette` option with 8 schemes: `default`, `nord`, `tokyo-night`, `dracula`, `gruvbox`, `catppuccin`, `solarized`, `monochrome`. Swaps the semantic hues (green/orange/yellow/red still mean low/warn/high/crit — only the RGB changes).
- **Bar styles.** New `barStyle` option: `dots` (●○), `blocks` (█░), `braille` (⣿⣀), `ascii` (#-), `hearts` (♥♡), `arrows` (▰▱). Decoupled from the ascii/unicode icon fallback so every style works on modern terminals.
- **Wizard gradient demo.** Appearance page renders a 5-bar gradient (10/30/55/75/95%) under the live preview so palette + barStyle cycles show every threshold color at once.
- **Format options.** `modelFormat` (full/short/code), `dirStyle` (smart/basename/tilde/full), `branchStyle` (paren/bracket/brace/bare), `branchMaxLen`, `costPrecision` (0–4), `compactNumbers` (+1.2k), `hostnameStyle` (short/full), `spacing` (tight/normal/loose).
- **`smart` dir style (new default).** Shows `~/dev/<project>` when it fits within `dirMaxLen` (default 30), otherwise collapses to the basename. The previous `basename` behavior is preserved via `dirStyle: 'basename'`.

### Changed
- **`ctx` inline bar scaled to 20 bubbles** (was 8). Context is the busiest signal on the line; a 20-bubble scale shows real movement per turn. Tunable via `ctxBarWidth`.
- **`show.bars` now silences every bar-producing segment.** Previously it only affected the inline bubbles in `ctx`/`5h`/`7d`. Now it also strips the bar from `rate-5h-full`/`rate-7d-full` and hides the `context-bar` segment entirely.
- **Wizard split into 6 pages** (was 5): preset · appearance + palette · formats + git · core segments · rich segments · thresholds + advanced.
- **`ENUMS` single-source** shared between config validator and wizard so enum lists can't drift.

### Not breaking
All new fields have defaults, so existing saved configs keep working unchanged. The `ctx` bar widening only applies if a config doesn't set `ctxBarWidth`; pinned configs render exactly as before.

## [1.1.0] — 2026-04-18

### Changed
- `DEFAULTS.icons` flipped `auto` → `unicode`. Modern terminals overwhelmingly render unicode glyphs correctly; defaulting to `unicode` avoids the legacy allowlist-based auto-detection silently downgrading to ascii when `TERM_PROGRAM` is absent (a common state inside the statusline subprocess). Users on legacy environments can pick `ascii` or `auto` via the wizard.
- `pickIcons('auto')` rewritten as a **blocklist** instead of an allowlist: default to unicode unless there's concrete evidence the terminal can't render it. Specifically falls back to ascii when:
  - `TERM` is `dumb`, `linux`, or empty
  - session is SSH (`SSH_TTY` or `SSH_CONNECTION` set) **and** the locale isn't UTF-8
  - legacy `LEAN_STATUSLINE_ASCII=1` env override is set
- Previously the logic was "unicode only if `TERM_PROGRAM` matches a hand-maintained allowlist of ~10 terminals", which failed whenever `TERM_PROGRAM` was unset — notably inside Claude Code's render path in some configurations.

### Not breaking
Existing saved configs keep whatever `icons` value they have. `auto` still works; its meaning just got more generous. No config surface changes.

## [1.0.2] — 2026-04-18

### Changed
- Wizard: pressing `enter` on any field now advances to the next step (form-wizard convention). Previously `enter` was an alias for `→` and cycled enum values. Cycling still works via `←` / `→`; booleans still toggle with `space`. This matches the user-facing footer hint "enter / tab next step".
- Wizard: 5 essential segments (`ctx`, `5h`, `7d`, `rate-5h-full`, `rate-7d-full`) are now **locked** in the configure UI. They render as `[●] always on` and are skipped by `↑↓` navigation — you can't silently drop the primary signals by misclicking. Power users who really want them off can hand-edit `~/.claude/lean-statusline.json`.
- Wizard: toggleable segment count is now 15 (down from 20). Keeps the "core + rich" page pair comfortably under 20 rows.

## [1.0.1] — 2026-04-18

Documentation-only patch. No code behavior change.

### Fixed
- `AGENTS.md` release procedure's `awk` recipe now terminates at the `[label]: URL` compare-link block. Previously, extracting the oldest version's release notes bled the entire compare-link section into the output — all 18 backfilled GitHub release bodies had to be re-edited.
- `README.md` was missing documentation for `lean-statusline selfupdate` (shipped in 0.3.7). Added a new "update" section above "uninstall".

### Added
- `README.md`: npm + node + license badges at the top; explicit "stable since v1.0.0" note.
- `README.md#troubleshooting`: Windows-specific advice covering Claude Code's native-Windows `statusLine` regressions ([anthropics/claude-code#31670](https://github.com/anthropics/claude-code/issues/31670), [#44746](https://github.com/anthropics/claude-code/issues/44746)) and how to run the PTY test suite locally.
- `README.md#see-also`: cross-links to `CHANGELOG.md` and `AGENTS.md`.

## [1.0.0] — 2026-04-18

First stable release. Everything shipped in the `0.4.x` line has now had enough bake time that the public surface (config schema, CLI, segment names, preset names) is committed. Future `1.x.y` releases will avoid breaking these contracts.

### Added
- Public API commitment (below) is now covered by semver.
- `@lydell/node-pty` devDependency powers a real interactive test suite (`test/wizard.test.mjs`) that drives the TUI through a PTY — arrow keys, tab navigation, live-preview assertions. Closes the "implemented but untested" gap from the post-0.4.5 audit.
- Non-interactive render tests (`test/render.test.mjs`) cover every bug fix back to 0.3.0 (session→elapsed, resets_at shapes, used_percentage preference, effort env resolution, overflow badge, ssh silence, cli help/version).
- `.github/workflows/ci.yml` runs the full suite on `ubuntu-latest` + `macos-latest` against Node 20/22/24, plus a Windows smoke-test matrix (skips interactive TUI since ConPTY is flaky in CI per microsoft/node-pty#827).
- `AGENTS.md` — playbook for maintaining releases, CHANGELOG entries, GitHub releases, and the npm token flow.

### Changed
- `selfupdate` now passes `shell: true` to `spawnSync('npm', …)` on Windows so `npm.cmd` resolves correctly. Previously raised `ENOENT` on native Windows.
- `enterRawMode()` cleanup now calls `process.stdin.pause()` — prevents the raw-mode read from keeping the event loop alive after the wizard exits on Windows.

### Stable surface (semver-covered from here)
- **Config schema** at `~/.claude/lean-statusline.json`: `preset`, `segments`, `show.*`, `icons`, `colors`, `separator`, `contextBarWidth`, `thresholds.*`, `refreshInterval`.
- **Preset names**: `minimal`, `compact`, `full` (plus `classic` as a back-compat alias for `full`).
- **Segment names**: all entries in `KNOWN_SEGMENTS` (see `lib/config.mjs`).
- **CLI**: `install`, `uninstall`, `config`, `doctor`, `selfupdate`, `version`; flags on each as documented by `--help`.
- **Wizard keybindings**: `↑↓` / `←→` / `space` / `enter` / `tab` / `shift+tab` / `s` / `r` / `q` / `esc`.
- **Env vars**: `LEAN_STATUSLINE_*` (segments, icons, separator, no_color, show_bars, show_session, show_effort, ssh_host, ssh_kind, config, claude_home, raw_url).

## [0.4.5] — 2026-04-18

### Fixed
- `session` + `elapsed` segments no longer render duplicate output when both are listed in `config.segments`. Aliases de-dup at render time in `lib/segments.mjs:renderLine`.
- README no longer claims OSC 8 clickable dir (`show.dirLink`) was shipped — the flag had no implementation. Moved to "what's next" with an explicit "not implemented yet" label.
- Preset gallery in README brought current: 4 → 3 presets, no more absolute reset times in sample blocks, `--wizard` flag no longer emphasized (default since 0.3.9).

### Changed
- Wizard segments split into explicit `CORE_SEGMENTS` and `RICH_SEGMENTS` named lists instead of position-based slicing from `KNOWN_SEGMENTS`. Reordering `KNOWN_SEGMENTS` no longer silently reshuffles wizard pages.

## [0.4.4] — 2026-04-18

### Changed
- Hot-path efficiency pass:
  - `detectDangerousPerms()`, `resolveEffortLevel()`, `readContextPct()` hoisted to `ctx` in `renderFromStdin`. Previously two `spawnSync('ps', …)` per render (via `zapPrefix` + `hasZap`) plus one `readFileSync` of `~/.claude/settings.json` for the effort segment.
  - `applyEnvOverrides` fast path: skip `structuredClone(cfg)` when no `LEAN_STATUSLINE_*` / `NO_COLOR` env var is set (the common case).
- New `lib/tui.mjs` consolidates ANSI constants, `parseKey`, `readKey`, `enterRawMode`, `stripAnsi`. Both `lib/wizard.mjs` and `bin/lean-statusline.mjs#interactiveMenu` now import from it; wizard's richer key parser (shift-tab, page-up/down, home/end) is available everywhere.

### Removed
- Dead helpers `fmtTimeShort` + `fmtDateTimeShort` in `lib/segments.mjs` — orphaned when 0.4.3 dropped the absolute reset clock.

## [0.4.3] — 2026-04-18

### Changed
- Default preset flipped `minimal` → `compact`.
- Rate-limit "full" segments now show only the countdown (`(in 1h30m)`). The absolute reset clock (`⟳ 9:33am` / `⟳ apr 23, 3:02pm`) carried the same information less compactly — removed.

## [0.4.2] — 2026-04-18

### Added
- Wizard paginated into 5 stepped pages (preset / appearance + git / core segments / rich segments / thresholds + advanced). `tab` / `shift+tab` / `pagedown` / `pageup` move between steps. Preview always visible at the top.

## [0.4.1] — 2026-04-18

### Added
- Arrow-key navigation in the entry menu (shown on `lean-statusline` with no subcommand in a TTY). Number/letter shortcuts still work as a fast-path.

## [0.4.0] — 2026-04-18

### Added
- Interactive TUI configurator replacing the press-and-commit wizard. Schema-driven form with full-screen live preview, arrow-key navigation, space-toggle, per-segment checkboxes, threshold tuning.
- `refreshInterval` config key (0–60s).

## [0.3.9] — 2026-04-18

### Added
- `install` automatically launches the configure wizard after patching (in TTY contexts). `--no-wizard` opts out for scripted installs.

## [0.3.8] — 2026-04-18

### Changed
- Wizard preset-picker UX pass: 4 → 3 presets (`classic` merged into `full` since its extras were silent-until-triggered anyway). Removed the redundant bottom menu. Shortened descriptions. Compacted the ssh preamble.
- Context-bar rail glyph (`─` instead of `○`) for empty portion — reads as progress track, not fence of circles. Filled portion now color-graded.

### Fixed
- `config --preset classic` and `install --preset classic` migrate to `full` with a one-line notice instead of erroring.

## [0.3.7] — 2026-04-18

### Added
- `selfupdate` subcommand for global installs. Reports current vs registry version, runs `npm install -g lean-statusline@latest`. `--check` to probe without applying.

## [0.3.6] — 2026-04-18

### Fixed
- npx auto-detection now keys off `npm_lifecycle_event === 'npx'` + `npm_command === 'exec'` (verified against npm 11.12.1). The 0.3.5 attempt used `npm_config_user_agent` which empirically does not contain `npx/`.

## [0.3.5] — 2026-04-18

### Added
- Secondary npx detection via `npm_config_user_agent` (this check never fired in practice — corrected in 0.3.6).

## [0.3.3] — 2026-04-18

### Added
- Interactive menu when TTY + no subcommand. Previously hung waiting for stdin JSON.

## [0.3.2] — 2026-04-18

### Added
- Auto-detect when invoked via npx: patches `npx -y lean-statusline@latest` into `settings.json` so the command stays self-updating.
- `install --via {npx,global,node}` flag to force a specific runtime.

## [0.3.1] — 2026-04-18

### Changed
- `install` is now idempotent. Re-running always re-patches settings.json (with a fresh backup) instead of bailing with "already installed, use --force".

## [0.3.0] — 2026-04-18

First spec-aligned release. Read the official Claude Code statusline docs and fixed bugs it exposed.

### Fixed
- `session` segment read `input.session.start_time`, which does not exist in the spec. Always returned null on real renders. Switched to `cost.total_duration_ms` (segment renamed to `elapsed`; `session` kept as alias).
- Rate-limit `resets_at` parser now handles Unix seconds (the spec), Unix ms, and ISO strings. The previous `Date.parse`-only path rejected Unix seconds as NaN, silently hiding reset countdowns.
- `ctx` and `context-bar` segments prefer `context_window.used_percentage` when present (matches `/context` output). Manual recomputation from `current_usage` kept as fallback.

### Added
- Spec-driven segments: `cost`, `elapsed`, `lines`, `worktree`, `agent`, `vim`, `session-name`, `output-style`, `overflow`.
- Per-session rate-limit cache keyed off `session_id` per the spec's caching example. Falls back to the legacy shared path when `session_id` is absent.
- `dir` segment now prefers `workspace.current_dir` over `cwd` per spec recommendation.

## [0.2.2] — 2026-04-18

### Added
- SSH segment classifies LAN vs public IP. Private ranges (RFC 1918, 100.64/10 CGNAT/Tailscale, loopback, link-local, IPv6 ULA) render hostname in cyan; public IPs render the IP in magenta.
- `LEAN_STATUSLINE_SSH_HOST` / `LEAN_STATUSLINE_SSH_KIND` env overrides.

## [0.2.1] — 2026-04-18

### Changed
- `ssh` segment leads every preset by default. Silent on local sessions, renders 🔒 host on remote.

## [0.2.0] — 2026-04-18

First public release on npm.

### Added
- Node-only (zero deps) implementation of a Claude Code statusline.
- Four presets: `minimal`, `compact`, `full`, `classic` (classic merged into full in 0.3.8).
- p10k-style configure wizard with preset picker + per-preset live preview.
- SSH segment for remote-session indication.
- `install` / `uninstall` / `config` / `doctor` / `version` subcommands.

[Unreleased]: https://github.com/yigitkonur/lean-statusline/compare/v1.5.3...HEAD
[1.5.3]: https://github.com/yigitkonur/lean-statusline/compare/v1.5.2...v1.5.3
[1.5.2]: https://github.com/yigitkonur/lean-statusline/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/yigitkonur/lean-statusline/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/yigitkonur/lean-statusline/compare/v1.4.0...v1.5.0
[1.3.2]: https://github.com/yigitkonur/lean-statusline/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/yigitkonur/lean-statusline/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/yigitkonur/lean-statusline/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/yigitkonur/lean-statusline/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/yigitkonur/lean-statusline/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/yigitkonur/lean-statusline/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yigitkonur/lean-statusline/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yigitkonur/lean-statusline/compare/v0.4.5...v1.0.0
[0.4.5]: https://github.com/yigitkonur/lean-statusline/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/yigitkonur/lean-statusline/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/yigitkonur/lean-statusline/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/yigitkonur/lean-statusline/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/yigitkonur/lean-statusline/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.9...v0.4.0
[0.3.9]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.7...v0.3.8
[0.3.7]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.3...v0.3.5
[0.3.3]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/yigitkonur/lean-statusline/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/yigitkonur/lean-statusline/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/yigitkonur/lean-statusline/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/yigitkonur/lean-statusline/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/yigitkonur/lean-statusline/releases/tag/v0.2.0
