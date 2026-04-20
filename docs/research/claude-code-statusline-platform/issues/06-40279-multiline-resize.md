# Is it safe to ship multi-line (3+) statusline layouts?

**Scope:** Status of `#40279` (multiline collapses on resize) and implications for 2-line vs 3-line layouts.
**Last updated:** 2026-04-18
**Confidence:** High — direct issue read, independent repro in comments, stale label but recently updated.

## Answer

**Risky but not broken.** Multi-line statusline output renders correctly until the terminal is resized. On `SIGWINCH` (or Windows equivalent), only line 1 survives — lines 2+ are erased and do NOT re-render even on subsequent assistant messages. Recovery requires a full statusline subprocess re-invocation, which currently isn't triggered by resize events. Issue is **open** (with `stale` label, last updated 2026-04-14) on 2.1.86. Safe to ship 2-line layouts IF you put critical info on line 1; 3-line is materially worse because two of three lines vanish on resize. A layout policy of "≤2 lines, critical-first" is the practical guidance.

## Evidence

- Issue: [`#40279`](https://github.com/anthropics/claude-code/issues/40279), state: open, opened 2026-03-28, updated 2026-04-14, labels `bug / has repro / platform:macos / area:statusline / stale`, 1 comment, reported on 2.1.86 / Darwin 25.3.0 / Terminal.app / Opus 4.6.
- OP repro: script outputs 2+ lines via `printf '%b\n'`; initial render shows all lines; resize window narrower or wider; only line 1 persists.
- OP confirms: "Sending a new message does not fix it either" — so the re-render event doesn't recover multi-line.
- Comment (Astro-Han, 2026-03-28, also the author of a second statusline bug): confirms same behavior with 2-line layout. "This looks like a missing `SIGWINCH` handler (or equivalent) in the statusline rendering layer."
- OP's workaround: "Limiting statusline output to 2 lines and keeping essential info on line 1."
- Related: no "multiline resize" fix in 2.1.x changelog.
- Related open: `#48548` "[BUG] Custom status line content overlaps with resume hint on exit" — open, label `area:tui / area:statusline` — suggests the multi-line layout pipeline has broader edge cases.

### Documented vs inferred

- **Documented:** multi-line output is an officially supported feature ("Multiple lines: each echo or print statement displays as a separate row" — statusline docs). Resize kills it; that's a bug, not a limitation.
- **Inferred:** Ink's grid rendering does a partial erase/redraw that doesn't track extra lines beyond its expected height; on resize Ink re-computes its region and writes over former multi-line content without re-invoking the subprocess.

## Caveats / Negative Signal

- Label `stale` was added but OP commented after — so the bot marked stale but humans are still hitting it. As of 2026-04-14 update, it's active again.
- No platform isolation: labeled `platform:macos` but the root cause (SIGWINCH handler / Ink re-layout) is cross-platform.
- Some users report 2-line statuslines work fine until resize — in practice many never hit the bug because they don't resize during a session. But it's one `Cmd+` / `Cmd-` away from losing half the statusline.

## Impact on statusline ideas

- **2-line layouts:** safe to ship, provided line 1 carries everything critical (model, context %, cost, mode, pace). Line 2 is "nice to have" — it's understood to vanish on resize until the next event.
- **3-line layouts:** **unsafe to ship as default.** Two of three lines disappear on resize; only the top row is durable. Ship as opt-in (`STATUSLINE_LAYOUT=3line`) with a documented warning, or don't ship.
- **Responsive / width-aware layouts:** `#41512` shipped `workspace.git_worktree` and terminal dimensions (columns/rows) to the JSON payload in April 2026. So you CAN know the terminal width at render time and shed optional segments — recommended complement to multi-line strategies.
- **Pace / progress bars on line 2:** acceptable, but mark them as "loses on resize" and design the single-line fallback to be legible without them.

## Sources

- `anthropics/claude-code#40279` — 2026-03-28 — primary, 1 comment, updated 2026-04-14.
- `anthropics/claude-code#41512` — closed completed 2026-04-01 — terminal dimensions in JSON (enables responsive strategy).
- `anthropics/claude-code#48548` — open — related multi-line resume-hint overlap.
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — multi-line documented as supported.
