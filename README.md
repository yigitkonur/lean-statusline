# lean-statusline

one-line statusline for [claude code](https://claude.com/claude-code). the stuff you actually glance at, nothing you don't.

```
Opus 4.7 (1M context) · ✎ 2% · mcp-researchpowerpack-http (main*) · 5h 40% · 7d 47%
```

model · context % · dir (branch, `*` if dirty) · 5-hour + 7-day rate-limit usage. done.

node-only, zero deps, works on mac/linux/windows. no bash, no jq, no vendored binaries.

## why bother

the stock-ish 3-line statusline eats four rows above every prompt:

![before: the busy 3-line statusline](assets/current-statusline.png)

on a 40-row terminal that's 10% of your screen re-rendering every time claude emits something. lean-statusline collapses the same info to one line: numbers over bars, percentages over 88-char strips. session timer and effort indicator are opt-in, not default.

## install

### one-liner (recommended)

```bash
npm install -g lean-statusline
lean-statusline install
```

that's it. `install` backs up `~/.claude/settings.json`, wires the `statusLine` command, runs a smoke test, and tells you what it changed. restart claude code.

### no global install

```bash
npx lean-statusline install
```

same thing, without the global bin. the patched command in `settings.json` falls back to an explicit `node "/path/to/bin"` so it keeps working.

### from source

```bash
git clone https://github.com/yigitkonur/lean-statusline.git
cd lean-statusline
npm link          # or: node bin/lean-statusline.mjs install
```

### windows

works natively — no bash, no git bash, no wsl. just node 20+ on PATH.

```powershell
npm install -g lean-statusline
lean-statusline install
```

## what's on the line

| piece           | where it comes from                                                                |
|-----------------|------------------------------------------------------------------------------------|
| `Opus 4.7`      | `model.display_name` from claude code's stdin payload                              |
| `✎ 2%`          | `(input + cache_create + cache_read) / context_window_size`                        |
| `<dir>`         | basename of `cwd`                                                                   |
| `(main)`        | `git symbolic-ref --short HEAD` in `cwd`                                           |
| `(main*)`       | `*` = dirty working tree (via `status --porcelain`)                                |
| `5h 40%`        | anthropic usage endpoint, 5-hour bucket. stdin preferred, api fallback, 60s cache  |
| `7d 47%`        | same, 7-day bucket                                                                 |
| `⚡` (red)      | shown when claude code launched with `--dangerously-skip-permissions`              |
| `◐ auto` (opt)  | effort level from `$CLAUDE_CODE_EFFORT_LEVEL` (or `settings.json#env`)             |

percentages are color-graded: green under 50, orange 50–70, yellow 70–90, red 90+. thresholds are configurable.

## configure

config lives at `~/.claude/lean-statusline.json`. four ways to edit it:

```bash
lean-statusline config                  # interactive wizard
lean-statusline config --show           # print current (or defaults if no file)
lean-statusline config --edit           # open in $EDITOR
lean-statusline config --set show.bars=true separator=• icons=unicode
lean-statusline config --reset
```

full schema with defaults:

```json
{
  "segments": ["model", "ctx", "dir", "5h", "7d"],
  "show": {
    "branch": true,
    "dirty": true,
    "zap": true,
    "bars": false
  },
  "icons": "auto",
  "colors": true,
  "separator": "·",
  "thresholds": { "warn": 50, "high": 70, "crit": 90 }
}
```

**segments** — any subset of `model`, `ctx`, `dir`, `5h`, `7d`, `session`, `effort`. order matters.
**show.bars** — render `●●●●○○○○○○` strips next to each percentage. off by default because the number is the signal.
**icons** — `auto` (unicode on modern terminals, ascii elsewhere), `unicode` (force), or `ascii` (force).
**thresholds** — where the color gradient kicks in.

### env overrides

for one-session tweaks, env vars beat the config file:

| var                               | effect                                   |
|-----------------------------------|------------------------------------------|
| `LEAN_STATUSLINE_SEGMENTS`        | comma list, e.g. `model,ctx,dir`         |
| `LEAN_STATUSLINE_ICONS`           | `auto` / `unicode` / `ascii`             |
| `LEAN_STATUSLINE_SEPARATOR`       | any string, e.g. `|`                     |
| `LEAN_STATUSLINE_SHOW_BARS=1`     | turn on the `●●●○○○` bars                |
| `LEAN_STATUSLINE_SHOW_SESSION=1`  | add session-elapsed segment              |
| `LEAN_STATUSLINE_SHOW_EFFORT=1`   | add effort-level segment                 |
| `LEAN_STATUSLINE_NO_COLOR=1`      | kill colors (`NO_COLOR` also respected)  |

set them in claude code's `settings.json` under `env`:

```json
{
  "env": { "LEAN_STATUSLINE_SHOW_SESSION": "1" },
  "statusLine": { "type": "command", "command": "lean-statusline" }
}
```

## icon rendering — what breaks, how to fix

three unicode glyphs by default: `✎` (context), `⏱` (session), `⚡` (dangerous-perms). most modern terminals render them fine. the ones that don't get auto-downgraded.

**auto-detect fallback rules** (`icons: "auto"`):

1. `$SSH_TTY` or `$SSH_CONNECTION` set → ascii. remote terminals often lack the font.
2. `$TERM_PROGRAM` not in the allowlist → ascii. allowlist: `ghostty`, `iTerm.app`, `WezTerm`, `WarpTerminal`, `vscode`, `Apple_Terminal`, `Hyper`, `Tabby`, `rio`, `kitty`, `alacritty`.

if your terminal renders unicode but isn't in the allowlist, either set `icons: "unicode"` in the config, or `LEAN_STATUSLINE_ICONS=unicode`.

**common glyph failures:**

| symptom                                 | cause                                 | fix                                                     |
|-----------------------------------------|---------------------------------------|---------------------------------------------------------|
| `✎` shows as `□` / `?`                  | font lacks U+270E                     | install a nerd font, or set `icons: "ascii"`            |
| glyph renders but column width is off   | terminal misreports east-asian width  | `icons: "ascii"`                                        |
| colors missing                          | `NO_COLOR` set, or dumb terminal      | unset it; or `colors: false` is intentional             |

## doctor

```bash
lean-statusline doctor
```

checks node version, settings wiring, config validity, OAuth resolvability, leftover bash or ccline installs, and runs a smoke render. green ticks mean ready, warnings are non-fatal, reds fail with reason.

example output:

```
✓  node ≥ 20          running 25.9.0
✓  claude home exists /Users/you/.claude
✓  settings.json exists
✓  settings.json#statusLine wired to lean-statusline   lean-statusline
!  lean-statusline not on PATH                          using explicit node invocation (ok)
✓  using built-in defaults                              no ~/.claude/lean-statusline.json — that's fine
✓  OAuth token resolvable                               rate-limit fallback available
✓  smoke test passed                                    Opus 4.7 · ✎ 0% · …

all good
```

## troubleshooting

### nothing shows / statusline blank
run it by hand:
```bash
echo '{}' | lean-statusline
```
empty payload prints the literal `Claude` as a placeholder. any error is either a missing node (install node ≥ 20) or a malformed config (`lean-statusline config --show` will print the warning).

### rate-limit percentages missing
newer claude code builds send `.rate_limits` on stdin. older builds need the api fallback, which pulls a token from (in order):

1. `$CLAUDE_CODE_OAUTH_TOKEN`
2. macos keychain entry `Claude Code-credentials`
3. `~/.claude/.credentials.json`
4. `secret-tool` on linux (gnome-keyring)

if none resolve, `5h` and `7d` are silently omitted. that's correct behavior, not a bug.

### effort shows the wrong value / "default"
reads `$CLAUDE_CODE_EFFORT_LEVEL` first (claude code exports settings.json#env to child processes), then falls back to `settings.json#env.CLAUDE_CODE_EFFORT_LEVEL`. if you had the old bash version, it read the wrong key. the node version fixes this.

### colors look wrong
your terminal theme is probably overriding 24-bit colors. `colors: false` in config turns them off entirely.

### old bash statusline still present
`lean-statusline doctor` warns about `~/.claude/statusline.sh`. remove it manually once you're happy.

## uninstall

```bash
lean-statusline uninstall
npm uninstall -g lean-statusline   # if globally installed
```

`uninstall` removes the `statusLine` entry from settings.json and leaves a timestamped backup. the config file at `~/.claude/lean-statusline.json` stays (delete manually if you want).

## why node-only, zero deps

- **no jq required** — stock `JSON.parse` handles everything
- **no bash required** — windows just works
- **cold start ~30–50ms** on node 20+, which is fine for statusline render cadence
- **one tarball, one binary on PATH** — no vendored binaries, no `chmod +x` failures

## license

MIT.
