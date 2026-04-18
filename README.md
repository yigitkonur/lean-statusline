# lean-statusline

A one-line statusline for [Claude Code](https://claude.com/claude-code). Everything you actually read while coding, nothing you don't.

```
Opus 4.7 (1M context) · ✎ 2% · mcp-researchpowerpack-http (main) · 5h 40% · 7d 47%
```

Model • context usage • directory (git branch + dirty marker) • 5-hour + 7-day rate-limit usage. That's it.

## Why

The default-ish 3-line statusline (model line, rate-limit bars, and a 88-character context bar) looks like this:

![Before: the busy 3-line statusline](assets/current-statusline.png)

That's four rows of chrome above every prompt. On a 40-row terminal that's 10% of the screen, most of it re-rendering every keystroke.

**lean-statusline** collapses it to one line with the same information density for the parts you actually glance at: rate-limit percentages and context usage. Bars are dropped (numbers are the signal). The big context bar is dropped (the percentage already tells you). Session timer and effort indicator are opt-in.

## Install

### macOS / Linux / WSL / Git Bash

```bash
curl -fsSL https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/install/install.sh | bash
```

### Windows (native PowerShell)

```powershell
iwr -useb https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/install/install.ps1 | iex
```

Requires Git for Windows or WSL so Claude Code can invoke `bash`. Both installers are idempotent, back up `settings.json` with a timestamped suffix, and run a smoke test at the end. Restart Claude Code to see the new line.

### From a clone

```bash
git clone git@github.com:yigitkonur/lean-statusline.git
cd lean-statusline
./install/install.sh          # or install\install.ps1 on Windows
```

### Flags

| Flag                         | Meaning                                          |
|------------------------------|--------------------------------------------------|
| `--dir <path>` / `-Dir`      | Install to a directory other than `~/.claude`    |
| `--no-patch` / `-NoPatch`    | Don't touch `settings.json`                      |
| `--force` / `-Force`         | Overwrite an existing `lean-statusline.sh`       |
| `--uninstall` / `-Uninstall` | Remove the script and the `statusLine` entry    |

## What you get

| Segment      | Source                                                              |
|--------------|---------------------------------------------------------------------|
| `Opus 4.7`   | `model.display_name` from Claude Code's stdin payload               |
| `✎ 2%`       | `(input + cache_create + cache_read) / context_window_size`         |
| `<dir>`      | `basename $cwd`                                                     |
| `(main)`     | `git symbolic-ref --short HEAD` on `$cwd`                           |
| `(main*)`    | `*` = dirty working tree (unstaged/untracked via `--porcelain`)     |
| `5h XX%`     | Anthropic usage endpoint, 5-hour bucket. Stdin preferred, API fallback, 60-second cache |
| `7d XX%`     | Same, 7-day bucket                                                  |
| `⚡` (red)   | Shown when the Claude Code process has `--dangerously-skip-permissions` |

Percentages are color-graded: green <50%, orange 50–70, yellow 70–90, red 90+.

## Configuration

Opt-in extras via environment variable:

| Variable                           | Effect                                                  |
|------------------------------------|---------------------------------------------------------|
| `LEAN_STATUSLINE_SHOW_SESSION=1`   | Append session elapsed time (`⏱ 1h23m`)                |
| `LEAN_STATUSLINE_SHOW_EFFORT=1`    | Append effort indicator from `settings.json`            |
| `LEAN_STATUSLINE_ASCII=1`          | Force ASCII icons regardless of terminal detection      |
| `LEAN_STATUSLINE_NO_COLOR=1`       | Disable colors (`NO_COLOR` is also honored)             |

Set them in the `env` block of `~/.claude/settings.json`:

```json
{
  "env": { "LEAN_STATUSLINE_SHOW_SESSION": "1" },
  "statusLine": {
    "type": "command",
    "command": "bash \"/Users/you/.claude/lean-statusline.sh\""
  }
}
```

## Icon rendering & fallbacks

Two glyphs are unicode (`✎` for context, `⏱` for session elapsed, `⚡` for dangerous-perms). Most modern terminals render them cleanly; a few render them as tofu boxes or swallow the column width.

The script auto-detects and falls back to ASCII (`%`, `t`, `!`) in two cases:

1. **SSH sessions** — `$SSH_TTY` or `$SSH_CONNECTION` is set. Remote terminals often lack the font.
2. **Unknown terminal** — `$TERM_PROGRAM` is not one of: `ghostty`, `iTerm.app`, `WezTerm`, `WarpTerminal`, `vscode`, `Apple_Terminal`, `Hyper`, `Tabby`, `rio`.

If your terminal *does* render unicode but isn't on the allowlist, add it to `TERM_PROGRAM` detection in `lean-statusline.sh` or just ignore this and set `LEAN_STATUSLINE_ASCII=1` in the other direction if the glyphs look bad.

**Common culprits for broken glyphs**

| Symptom                                 | Cause                              | Fix                                                                     |
|-----------------------------------------|------------------------------------|-------------------------------------------------------------------------|
| `✎` shows as `□` / `?`                  | Font lacks U+270E                  | Use a Nerd Font or a font with good Misc Symbols coverage               |
| Glyph visible but column width off      | Terminal misreports East-Asian width | Set `LEAN_STATUSLINE_ASCII=1`                                           |
| Glyph appears as literal `\033[...m✎`    | Terminal doesn't interpret ANSI    | You're in a piped/non-TTY context — expected                             |
| Colors missing entirely                 | `NO_COLOR` set, or dumb terminal   | Unset `NO_COLOR`, or run in a real TTY                                   |

The narrowest possible ASCII variant is guaranteed to work everywhere a POSIX shell runs — Git Bash on Windows included.

## Dependencies

- **bash** 3.2+ (macOS default bash works)
- **jq** — JSON parsing
- **curl** — only for the rate-limit fallback path when Claude Code doesn't ship limits on stdin
- **git** — optional, used only when inside a work tree

Install hints:

```
macOS:         brew install jq
Debian/Ubuntu: sudo apt install jq
Fedora:        sudo dnf install jq
Arch:          sudo pacman -S jq
Windows:       scoop install jq   # or   winget install jqlang.jq
```

## Troubleshooting

### "Statusline command failed" / nothing shows

Run it by hand:

```bash
echo '{}' | bash ~/.claude/lean-statusline.sh
```

Empty output is fine (the script prints `Claude` as a placeholder in that case). An error means a missing dependency or a bad shebang — usually CRLF line endings on Windows. The PS1 installer normalizes LF; if you edited the file in Notepad, run `dos2unix ~/.claude/lean-statusline.sh`.

### Permission denied

```bash
chmod +x ~/.claude/lean-statusline.sh
```

This is the single most common failure mode for hand-installed statuslines. Both installers do this for you.

### Rate-limit percentages missing

Claude Code only sends `.rate_limits` on stdin in newer builds. Older builds fall back to an API call using the OAuth token from (in order):

1. `$CLAUDE_CODE_OAUTH_TOKEN`
2. macOS Keychain entry `Claude Code-credentials`
3. `~/.claude/.credentials.json`
4. `secret-tool` on Linux (gnome-keyring)

If none resolve, the 5h/7d segments are silently omitted. That's correct behavior — not an error.

### Colors look wrong

Your terminal theme is probably overriding the 24-bit colors the script emits. Set `LEAN_STATUSLINE_NO_COLOR=1` or pick a theme that respects true color.

## Uninstall

```bash
./install/install.sh --uninstall
# or, from the URL installer:
curl -fsSL https://raw.githubusercontent.com/yigitkonur/lean-statusline/main/install/install.sh | bash -s -- --uninstall
```

Removes the script and the `statusLine` entry from `settings.json`. A timestamped backup of `settings.json` is left behind.

## License

MIT.
