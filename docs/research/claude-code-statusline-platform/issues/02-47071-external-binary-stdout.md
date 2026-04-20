# Do external binaries in `statusLine.command` produce captured stdout?

**Scope:** Current status of `#47071` and implications for shipping Python/Node/Go statusline binaries on Windows.
**Last updated:** 2026-04-18
**Confidence:** High — direct issue read, systematic test matrix in OP, side-effect comment documents follow-on problem.

## Answer

**Broken on Windows, works on macOS/Linux.** On Windows (Claude Code 2.1.92), external binaries (`python3`, `py`, `node`, even full-path `C:\Python\python.exe`) produce no captured stdout — the statusline stays empty with no error. Only bash builtins (`echo`, `printf`) work. The mandatory workaround is wrapping the command in `bash -c '…'`, which itself spawns a `conhost.exe` every prompt cycle — measurable resource churn for multi-session users. Issue **open** as of 2026-04-18, 2 comments, no fix in 2.1.x changelog.

## Evidence

- Issue: [anthropics/claude-code#47071](https://github.com/anthropics/claude-code/issues/47071), state: open, opened 2026-04-12, last updated 2026-04-13, labels `bug / has repro / platform:windows / area:statusline`, on 2.1.92.
- OP systematic test matrix (verbatim):
  - `echo TEST` (builtin) — captured Yes
  - `printf 'text'` (builtin) — captured Yes
  - `py statusline.py` (external) — **No**
  - `python statusline.py` (external) — **No**
  - `/full/path/to/python statusline.py` (external, absolute) — **No**
  - `python -c "print('X')"` (external, inline) — **No**
  - `bash -c 'python -c "print(X)"'` (wrapped) — Yes
  - `bash -c 'py statusline.py'` (wrapped) — Yes
- OP confirmed with a debug wrapper: Claude Code DOES send JSON to stdin and the script DOES produce stdout — the stdout is simply not captured.
- Comment (greydove749, 2026-04-13) documents the side effect: the `bash -c` workaround spawns a `conhost.exe` per invocation. Process chain `conhost.exe ← bash.exe ← node.exe (Claude Code) ← conhost.exe (session terminal)`. With N sessions × prompts/min, Windows users see measurable background process churn.
- Bot flagged possible duplicates #31670, #26558, #18469 — not closed.
- No related fix appears in the 2.1.93–2.1.114 changelog (reviewed 2026-04-18).

### Documented vs inferred

- **Documented:** bug is Windows-specific (label `platform:windows`); macOS/Linux users run Python/Node statuslines without a wrapper in every public tutorial and gist reviewed.
- **Inferred:** the root cause is likely a Windows `spawn` codepath that doesn't wire the child's stdout back to the capture buffer unless the child is actually a shell. A PR would likely need to touch the child-process adapter.

## Caveats / Negative Signal

- The AKCodez public gist and other community tutorials use `"command": "python3 ~/.claude/statusline.py"` directly on macOS with no bash wrapper, which works. Windows ports of those tutorials quietly fail unless the user reads issue #47071.
- The bash wrapper is not a no-op — it triggers #44119 / #42710 / #42418 territory (Windows conhost spawn, IntelliJ/Jetbrains terminal suppression under `CLAUDE_CODE_NO_FLICKER=1`) in some combinations.
- Bash-on-Windows dependency: the workaround assumes Git Bash is installed and on PATH. Users on pure PowerShell without Git for Windows have no workaround at all.

## Impact on statusline ideas

- Any idea with a *Python/Node/Rust binary* entry point must either (a) ship a bash-wrapped command string on Windows, (b) provide a `.bat`/`.ps1` shim that redirects through a shell, or (c) be published as pure `bash` / `jq` only. For a lean cross-platform binary strategy this is a real doability hit on Windows.
- For a Node.js CLI (like the current lean-statusline): on Windows, `node ~/.claude/statusline.mjs` is in the failing pattern. Need a `bash -c` wrapper in the installer or a platform-switched command string.

## Sources

- `anthropics/claude-code#47071` — OP systematic test matrix — 2026-04-12 — primary.
- `anthropics/claude-code#47071` (comment) — greydove749 — 2026-04-13 — conhost side-effect measurement.
- Anthropic changelog 2.1.92 → 2.1.114 — reviewed 2026-04-18 — no external-binary capture fix listed.
