# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

— nothing yet.

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

[Unreleased]: https://github.com/yigitkonur/lean-statusline/compare/v1.1.0...HEAD
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
