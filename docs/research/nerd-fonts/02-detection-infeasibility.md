# Why detecting "user has a Nerd Font active" is not feasible from a spawned shell process

**URL:** https://github.com/ryanoasis/nerd-fonts/discussions/829
**Scraped:** 2026-04-21
**Relevance:** `lean-statusline` is spawned by Claude Code on each statusline update. It runs for ~50ms, must emit output, and exits. It cannot open a GUI, cannot ask the user, and cannot reliably probe the terminal's font config. The maintainer's own answer to this question is instructive.

## Maintainer-authored excerpts

From the discussion thread (maintainer responding; no authoritative "label=maintainer" was visible in the scrape, but the answers are consistent with the project's docs):

> "_no_"

> "I believe there is no general way to do this."

> "There might be a terminal specific way to do it, but I deem even that unlikely."

> "You would at least need to find out which font is the main used font. Then you could check yourself with system tools. That would ignore system wide font fallback (if supported). And then there are terminal emulators that support multiple active fonts for different codepoint ranges."

> "I guess this is somehow like 'has the user a color terminal or not?' of old. It was (is?) not really possible to determine that."

> "`ls` has a switch to turn ansi color on because the automatism is so flaky..."

### Proposed convention

> "Should there be a convention of using a specific env variable to mean 'I am using a nerd font'? Like `export NERD_FONT=1`?"

This is a suggestion, not a shipped standard. No environment variable is widely recognized as "the" Nerd Font capability signal.

### The workaround: explicit user config

> "You can only put that into your application and instruct your users that they can/have to give `--use-nerd-font-icons` on the command line or something, or set an environment var or another if they want your application to utilize codepoints that might or might not be in a non-Nerd-Font."

## Why fontconfig probes don't close the gap

`fc-list | grep -i nerd` or `fc-match` tell you what's **installed** system-wide, not what's **active** in the terminal. Terminal font config lives in:

- **iTerm2**: per-profile `~/Library/Preferences/com.googlecode.iterm2.plist`
- **Kitty**: `~/.config/kitty/kitty.conf` `font_family`/`symbol_map`
- **Alacritty**: `~/.config/alacritty/alacritty.yml` or `alacritty.toml` `font.normal.family`
- **Ghostty**: `~/.config/ghostty/config` `font-family`
- **WezTerm**: `~/.config/wezterm/wezterm.lua` `wezterm.font_with_fallback`
- **VSCode integrated terminal**: `settings.json` `terminal.integrated.fontFamily`
- **Windows Terminal**: `settings.json` `profiles.defaults.font.face`
- **GNOME Terminal / tilix / xfce4-terminal**: dconf / profiles

None of these are introspectable from a child `node` process in any portable way. A subprocess can only see:

- `process.env` (no font info)
- stdin/stdout TTY dimensions (`process.stdout.columns`)
- `TERM_PROGRAM` (emulator name, rarely present)

**False positive risk** if we did try `fc-list`-based probing: system has JetBrains Mono Nerd Font installed but the terminal uses plain JetBrains Mono → our detector says "nerd available", output renders as tofu squares.

**False negative risk**: system has "JetBrainsMonoNerdFont-Regular.ttf" installed but fontconfig's `fc-list` reports it under a differently-quoted name → our detector says "no nerd font", user loses the icons they wanted.

## How peer tools handle this — all opt-in

- **starship** — no font probe; config field `format = "$symbol"` is populated with icons only when the user's theme opts in.
- **powerlevel10k** — during `p10k configure`, asks the user: "Does this look like a diamond (rotated square)?" as a visual test. If yes, user has a Nerd Font; if no, show a different preset. This is a **runtime interactive test** we cannot do in a non-interactive statusline.
- **oh-my-posh** — themes are named `powerlevel10k_modern.omp.json`, `jandedobbeleer.omp.json` — the user picks a theme and that choice implies "I have a nerd font". No probe.
- **ccstatusline** (competitor) — config field.

## Recommendation for `lean-statusline`

1. **Do not attempt font detection.** It will produce bad outcomes either direction.
2. **Expose a config field**: `icons: "nerd"` (in addition to the existing `"ascii" | "unicode" | "auto"`). The wizard or a README snippet explains how to enable it.
3. **Accept one env var** for power users: `LEAN_STATUSLINE_ICONS=nerd` (matches the existing `LEAN_STATUSLINE_ASCII=1` / `LEAN_STATUSLINE_NO_COLOR` patterns).
4. **Auto mode stays conservative** — it picks unicode when the locale is UTF-8 and not SSH-without-UTF-8, but never nerd. Nerd is strictly opt-in.
5. **Ship README documentation** that shows the "install Symbols Nerd Font Mono as fallback" recipe for each major terminal. Most users who have "a nerd font" got there by installing Symbols NF as a fallback — the recipe is easy and works even if their primary font isn't Nerd-patched.

## Relevant referenced URLs from the thread (for follow-up)

- `/etc/profile.d/` — suggested location for an install script to set `NERD_FONT=1`.
- `CLICOLOR` — cited as environment-variable precedent for color (BSD).
- `--use-nerd-font-icons` — the suggested CLI flag pattern.
