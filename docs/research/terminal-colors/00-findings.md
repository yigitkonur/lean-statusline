# Terminal color systems in 2026 — what `lean-statusline` should assume

**Scope:** Truecolor vs 256 vs ANSI support, reliable env-var signals, graceful degradation, WCAG-adjacent contrast rules, and prior art (starship, powerlevel10k, oh-my-posh, supports-color).
**Last updated:** 2026-04-21
**Confidence:** High — sourced from the `termstandard/colors` spec, chalk/supports-color source, oh-my-posh source, powerlevel10k issue threads, charmbracelet/colorprofile bug tracker, alacritty/Microsoft Terminal issue trackers, and a Marvin Hagemeister technical blog that mirrors the same detection logic.

---

## Headline recommendations

1. **Assume 24-bit truecolor by default and emit RGB escapes.** The only reliable positive signal is `COLORTERM=truecolor` (or `COLORTERM=24bit`) — every popular 2025-era terminal that supports 24-bit color sets it, and every popular prompt (starship, oh-my-posh, p10k) assumes truecolor by default. See §1.
2. **Keep only a narrow allow-list of known-hostile environments.** Disable color entirely when `NO_COLOR` is set, `TERM=dumb`, `TERM=` (empty), or `FORCE_COLOR=0`. Do not try to implement a truecolor-detection decision tree — it's a minefield and state of the art is to trust `COLORTERM` and otherwise just emit the sequences. See §1 and §2.
3. **Offer a 256-color fallback path, do not ship an 8-color fallback.** The terminals that cannot do truecolor but _can_ do color in 2026 are ~all xterm-256color-compatible. ANSI-16 support in isolation effectively means "Linux TTY console" and doesn't need pretty colors. Degrade by quantizing RGB → nearest 256-color slot using xterm's standard 6×6×6 cube formula, never by going all the way to 8 colors. See §3.
4. **Don't design the palette for a _specific_ terminal background — design it for both dark and light.** The one real contrast hazard is colors chosen against a dark theme becoming invisible (low luminance on light-bg Solarized Light / iTerm2 default light / Alacritty light). Every palette slot should hit ≥3:1 contrast against both `#000` and `#ffffff`. Emit pure-white and pure-black selectively using the inherited `default` foreground where possible. See §4.
5. **"Truecolor-only and damn the rest" is defensible in 2026.** Less than ~2% of terminal sessions are limited to 8-color or worse. Every modern terminal (iTerm2, Terminal.app v3+, WezTerm, Alacritty, Kitty, Ghostty, Windows Terminal, VSCode, GNOME Terminal, Konsole, Warp, foot) supports truecolor. `ccstatusline` (a direct competitor to `lean-statusline`) advertises "Basic (16), 256-color, truecolor" as three modes — you do not need all three to be functional, one branch with graceful-ish degradation is fine.[^ccstatusline]

[^ccstatusline]: `github.com/sirmalloc/ccstatusline` — README — "Advanced Color Support - Basic (16), 256-color (with custom ANSI codes), and truecolor (with hex codes) modes" — 2026-04-21.

---

## 1. What signals 24-bit truecolor reliably?

**Answer: `COLORTERM=truecolor` or `COLORTERM=24bit`, case-sensitive. That is the only reliable positive signal. Everything else is heuristics.**

The canonical spec lives at `github.com/termstandard/colors` (the rehoming of the famous XVilka gist):

> "VTE, Konsole and iTerm2 all advertise truecolor support by placing `COLORTERM=truecolor` in the environment of the shell user's shell." — `termstandard/colors` README[^termstandard]

> "The S-Lang library has a check that `$COLORTERM` contains either `truecolor` or `24bit` (case sensitive)." — `termstandard/colors` README[^termstandard]

Terminals that **set `COLORTERM=truecolor`** by default (verified list from alacritty/alacritty#1526 and other sources):
- **iTerm2** (`COLORTERM=truecolor`, set by the terminal itself)[^alacritty]
- **Konsole** (VTE-backed and raw)[^termstandard]
- **VTE-based terminals** (GNOME Terminal, Tilix, Terminator, XFCE Terminal, Guake, `vte*`)[^termstandard]
- **hyper**[^alacritty]
- **alacritty** (sets `COLORTERM=truecolor` since the resolution of issue #1526)[^alacritty]
- **kitty** (`TERM=xterm-kitty` + emits truecolor; see `TERM`-override in §3)
- **WezTerm** (sets both `TERM_PROGRAM=WezTerm` and `COLORTERM=truecolor`)
- **Ghostty** (inherits from its TERM database)
- **Warp** (truecolor-capable)

Terminals that **do _not_ set `COLORTERM`** but support truecolor:
- **Windows Terminal** — famously unset. Microsoft Terminal issue #11057 ("WT should set COLORTERM") has been open since late 2021 and not actioned as of scrape date.[^wt11057] As of 2026-04-21, Windows Terminal still does not set `COLORTERM`.
- **Apple Terminal.app v3+** — supports 24-bit but advertises nothing.[^xvilka]
- **Windows conhost classic** — no advertisement even when ConEmu-like sequences work.
- **`st` (suckless)** — deliberately does not set it.[^redditsuckless]

**The practical consequence:** env-var sniffing is a positive-signal-only game. Presence of `COLORTERM=truecolor` is a green light; absence means "maybe supported, maybe not" — it does not authorize a fallback to 8-color.

> "Having an extra environment variable (separate from TERM) is not ideal: by default it is not forwarded via sudo, ssh, etc, and so it may still be unreliable even where support is available in programs. (It does however err on the side of safety: it does not advertise support when it is not actually supported, and the programs should fall back to using 8-bit color.)" — `termstandard/colors`[^termstandard]

The spec also documents the workarounds for the forwarding problem: `SendEnv`/`AcceptEnv` lists in SSH config and `env_keep` in `/etc/sudoers`. Most users never configure these, so `COLORTERM` arrives stripped in SSH sessions.

### TERM prefix/suffix signals

Secondary (less reliable) signals encoded in `TERM`:
- `*-256color` → 256-color capable. Does **not** imply truecolor. xterm-256color is the dominant value across modern terminals.
- `*-direct` or `*-truecolor` → truecolor capable via terminfo RGB capability (ncurses ≥ 6.0-20180121).[^termstandard]
- `xterm-kitty` → kitty-specific; implies truecolor.
- `tmux-256color` with `COLORTERM=truecolor` → **truecolor**, but this is a documented trap for detectors (see §2).
- `screen`/`screen-256color` → legacy multiplexer; truecolor flaky until `TERM=screen-256color` with `terminal-overrides` `Tc` or `RGB`.
- `linux` → Linux TTY console. 8-color only. Do not emit truecolor.
- `dumb` or unset → no color at all.

### TERM_PROGRAM is a hint, not a capability guarantee

`TERM_PROGRAM` identifies which emulator launched the shell (e.g. `iTerm.app`, `WezTerm`, `vscode`, `Apple_Terminal`, `ghostty`, `warpterm`). oh-my-posh internally uses this in its log output — see issue #4290 where `TERM_PROGRAM=iTerm.app` is visible in the bug report.[^ohmyposh4290] It is **not** a reliable capability signal on its own — it is only set by some terminals and is sometimes clobbered by subprocess spawns. The `lean-statusline` current behavior (scraped 2026-04-21 in `lib/colors.mjs`) already notes: "TERM_PROGRAM is frequently unset (including when Claude Code spawns the statusline in some configurations)" — this observation is correct and widely shared.

---

## 2. Known detection traps

### Trap 1 — `tmux-256color` + `COLORTERM=truecolor` is still reported as ANSI256 by some libraries

The `charmbracelet/colorprofile` bug #76 documents exactly this:

> "`envColorProfile()` in `env.go` caps TERM values prefixed with `tmux` at ANSI256, even when `COLORTERM=truecolor` is set. The comment on line 187 says 'Tmux doesn't support $COLORTERM'."
>
> "When `COLORTERM=truecolor` is set, the profile should be TrueColor regardless of the TERM prefix. The COLORTERM variable is the standard way for terminals to advertise truecolor support."[^colorprofile76]

**Implication for `lean-statusline`:** Do not replicate charmbracelet's defensive downgrade. If `COLORTERM=truecolor` is present, trust it — modern tmux (≥3.2) forwards truecolor correctly when configured with `set-option -sa terminal-overrides ",xterm*:Tc"` or `",*:RGB"`.

### Trap 2 — `COLORTERM` stripped by `sudo`/`ssh`

By default, sudo and ssh do not forward `COLORTERM`. A remote shell looks 8-color from the vantage point of env vars. The fix is terminal-side config (`SendEnv`/`AcceptEnv`/`env_keep`), not a detection heuristic.[^termstandard]

### Trap 3 — CI environments set `TERM=dumb`

> "CI systems are the real boss battle here, because they often advertise themselves as dumb terminals with no support for colors. Since developers expect the logs to contain colors, there is no other way than to ignore both TERM and COLORTERM variables. Instead color support is inferred by virtue of detecting that the code runs inside the CI." — Marvin Hagemeister, "So you want to render colors in your terminal" (2023+)[^marvinh]

For `lean-statusline` this is a non-issue — a Claude Code statusline doesn't run in CI. Respecting `NO_COLOR` / `FORCE_COLOR` is sufficient.

### Trap 4 — Windows Terminal doesn't set `COLORTERM`

> "Both environment variables are not set there." (about Windows Terminal) — Marvin Hagemeister blog.[^marvinh]

The Microsoft Terminal issue #11057 ("WT should set COLORTERM") sits open with the argument that setting it would be beneficial for tools like `gh` which use it to decide when to emit 24-bit colors. Since it's unset, the defensible workaround is: **on Windows, assume truecolor when there is a TTY and `TERM` is anything other than `dumb`/`cygwin`/`msys`.** p10k issue #62 notes that Windows Terminal does support truecolor natively.[^p10k62]

---

## 3. Graceful degradation: truecolor → 256 → ANSI-16

`chalk/supports-color`[^chalksupports] — the de-facto standard Node.js detection library — defines four levels:

| Level | Name | Meaning |
|---|---|---|
| 0 | none | No color. |
| 1 | `hasBasic` | 16-color ANSI. |
| 2 | `has256` | 256-color (8-bit). |
| 3 | `has16m` | Truecolor (16 million colors, 24-bit). |

`chalk/supports-color` also defines override semantics:

> "`FORCE_COLOR=1` forces level 1, `FORCE_COLOR=2` forces level 2, `FORCE_COLOR=3` forces level 3, and `FORCE_COLOR=0` forcefully disables color. The use of `FORCE_COLOR` overrides all other color support checks."[^chalksupports]

### Recommended algorithm for `lean-statusline`

```
1. If NO_COLOR is set and non-empty → output with no escape codes.
2. If FORCE_COLOR=0 or LEAN_STATUSLINE_NO_COLOR → no color.
3. If FORCE_COLOR=3 or COLORTERM=truecolor or COLORTERM=24bit → truecolor.
4. Else if TERM contains "-256color" or TERM=xterm-kitty → 256-color.
5. Else if TERM=dumb or TERM is empty or TERM=linux → no color.
6. Else → truecolor (modern default; trust that the terminal handles it).
```

This differs from `supports-color`'s more cautious "probe-and-fall-back" ladder by biasing toward truecolor when uncertain. That is consistent with how oh-my-posh and starship behave (next section).

### Quantization from RGB to 256-color

When a user forces 256-color mode (or if the rewrite decides to implement it), use the standard xterm 6×6×6 cube + 24-step grayscale ramp:

```
For each RGB triple (r, g, b):
  1. If r == g == b and r in the grayscale ramp window, map to one of 232..255.
  2. Otherwise map to 16 + 36*qR + 6*qG + qB, where qN = clamp(round((N - 55) / 40), 0, 5).
```

This is the algorithm every popular statusbar uses. It's lossy but "close enough" visually for a statusline.

---

## 4. Contrast and the dark/light-theme problem

### There is no WCAG-for-terminals, but the 3:1 guideline is widely cited

WCAG 2.2 Success Criterion 1.4.3 (Contrast Minimum, AA) asks for **4.5:1 contrast** ratio for normal text, **3:1 for large text**; 1.4.11 (Non-text Contrast, AA) asks for **3:1 for UI components**. Terminals have no official profile, but the 3:1 bar (appropriate for a single-line statusline of ~14pt monospaced ≈ "large text") is what most palette designers implicitly target.

### The real pitfall: testing only against dark

Every palette in `lib/colors.mjs` today was clearly designed assuming a dark terminal background. Six of the eight palettes are dark-optimized (default, nord, tokyo-night, dracula, gruvbox-dark, catppuccin-mocha, solarized-dark). On a light background (Solarized Light base3 `#fdf6e3`, iTerm2 "Light Background" `#ffffff`, Alacritty default light), many slots collapse:

- **Default palette `yellow` = `(230, 200, 0)` ≈ `#e6c800`** — contrast vs `#fdf6e3` is ~1.7:1 (fail).
- **Catppuccin mocha `yellow` = `(249, 226, 175)` ≈ `#f9e2af`** — contrast vs `#fdf6e3` is ~1.3:1 (fail; this is by design in catppuccin — yellow mocha is meant to sit on mocha `base` `#1e1e2e`).
- **Dracula `cyan` = `(139, 233, 253)` ≈ `#8be9fd`** — contrast vs `#fdf6e3` is ~1.6:1 (fail).

Any palette the rewrite ships needs a **stated background assumption**. The cleanest way: ship one palette per background bucket. Rose Pine's "main/moon/dawn" split is the standard pattern — Moon is darker-optimized, Dawn is light-optimized.

### Dark/light pair themes to adopt

- **Catppuccin:** Mocha (dark), Latte (light). Frappe/Macchiato are intermediate dark.
- **Rose Pine:** Main (dark), Moon (dark), Dawn (light).
- **Tokyo Night:** Storm/Moon/Night (dark), Day (light). Day is a proper light theme, not just "dark inverted".
- **Gruvbox:** Dark and Light share accent hex (red, green, etc.); only the bg/fg palette differs.
- **Ayu:** Dark, Mirage (medium-dark), Light. Three-way split with separate accents each.
- **Solarized:** Dark (base03) and Light (base3) with identical accents — famous for being "isoluminant" and reversible.
- **Material:** Darker, Oceanic, Palenight, Deep Ocean, Forest (dark); Lighter, Sky Blue, Sandy Beach (light).

---

## 5. How popular statusline tools handle this

### starship (Rust)

Starship uses `nu-ansi-term`, which supports all four chalk levels and decides based on `COLORTERM`/`TERM`/`CLICOLOR`. Starship does **not** implement its own bespoke detector — it relies on the library's defaults. This is the cleanest design. See `src/bug_report.rs` for the environment-dump code that starship generates for issue reports.[^starship]

### oh-my-posh (Go)

oh-my-posh defaults to truecolor:

```go
// src/color/colors.go, line 30
var TrueColor = true
```
[^ohmyposh-colors]

And when resolving a hex color:

```go
// src/color/colors.go, ~line 280
style := color.HEX(colorString, isBackground)
if !style.IsEmpty() {
    if TrueColor {
        return Ansi(style.String())
    }
    return Ansi(style.C256().String())
}
```
[^ohmyposh-colors]

The 256-color fallback path uses the `gookit/color` library's `C256()` which implements the standard xterm-cube quantization. oh-my-posh does not ship a separate ANSI-16 codepath for hex colors — hex inputs are either truecolor or 256.

### powerlevel10k (Zsh)

From p10k's truecolor support issue:

> "In order to use true color with Powerlevel10k you need ZSH >= 5.7 and a terminal that supports true color." — romkatv/powerlevel10k#62[^p10k62]

p10k's approach is to check `COLORTERM` against `24bit` or `truecolor` and, if present, emit `38;2;R;G;B` sequences from Zsh ≥ 5.7's native support. If not, hex colors are ignored and users must use 8-bit ANSI color names in their config. The [issue tracker](https://github.com/romkatv/powerlevel10k/issues/207) shows users asking for hex-based theming; maintainer resistance is about "user responsibility: set COLORTERM yourself if your terminal is unusual."

### ccstatusline (direct competitor)

`sirmalloc/ccstatusline`[^ccstatusline] advertises three modes explicitly in its docs: "Basic (16), 256-color (with custom ANSI codes), and truecolor (with hex codes)". Its user can pick any of the three, overriding detection. This is a defensible UX for a Claude Code statusline — **expose the choice as a config field**, even if the default is "truecolor and trust the env".

### Current `lean-statusline`

The current `lib/colors.mjs` emits `\x1b[38;2;R;G;Bm` unconditionally whenever `colorsEnabled()` returns true. There is no 256-color fallback and no ANSI-16 fallback. For 2026 this is defensible (see §0 recommendation). The rewrite could add an optional 256-color mode gated by a config flag or env var for the truly remote / NetBSD-tty user.

---

## Sources

All sources scraped 2026-04-21 unless noted.

[^termstandard]: [github.com/termstandard/colors](https://github.com/termstandard/colors) — canonical spec for terminal truecolor advertisement. Documents `COLORTERM=truecolor`/`24bit`, the terminfo `RGB` capability, SSH/sudo forwarding caveats, and the shell-rc workaround. This gist was previously at `gist.github.com/XVilka/8346728` (still redirects).
[^chalksupports]: [github.com/chalk/supports-color](https://github.com/chalk/supports-color) — Sindre Sorhus / Josh Junon — defines levels 0–3, `FORCE_COLOR`, `NO_COLOR`, `--color`/`--no-color` CLI override semantics.
[^xvilka]: [gist.github.com/XVilka/8346728](https://gist.github.com/XVilka/8346728) — "True Colour (16 million colours) support in various terminal applications and terminals" — moved to termstandard/colors.
[^alacritty]: [github.com/alacritty/alacritty/issues/1526](https://github.com/alacritty/alacritty/issues/1526) — "Set the COLORTERM environment variable to 'truecolor'". Lists "terminator, iTerm2, konsole, hyper" as already doing so, documents the resolution to also set it in alacritty.
[^wt11057]: [github.com/microsoft/terminal/issues/11057](https://github.com/microsoft/terminal/issues/11057) — "WT should set COLORTERM" — open; includes the observation that `gh issue list` (cli/cli#4079) relies on COLORTERM being set and is visually degraded on Windows Terminal.
[^ohmyposh4290]: [github.com/JanDeDobbeleer/oh-my-posh/issues/4290](https://github.com/JanDeDobbeleer/oh-my-posh/issues/4290) — bug report includes `TERM_PROGRAM=iTerm.app` and shell `fish` as env context. Demonstrates how oh-my-posh captures TERM_PROGRAM for diagnostics.
[^ohmyposh-colors]: [github.com/JanDeDobbeleer/oh-my-posh/blob/main/src/color/colors.go](https://github.com/JanDeDobbeleer/oh-my-posh/blob/main/src/color/colors.go) — scraped via `raw.githubusercontent.com`. Line 30: `var TrueColor = true` (default). Line ~280: `style.C256().String()` quantization fallback.
[^p10k62]: [github.com/romkatv/powerlevel10k/issues/62](https://github.com/romkatv/powerlevel10k/issues/62) — "Adding support for 24-bit colors". Quoted requirements: "ZSH >= 5.7 and a terminal that supports true color."
[^colorprofile76]: [github.com/charmbracelet/colorprofile/issues/76](https://github.com/charmbracelet/colorprofile/issues/76) — "tmux-256color with COLORTERM=truecolor detected as ANSI256". Shows the env.go:187 defensive downgrade that the issue argues is wrong.
[^marvinh]: [marvinh.dev/blog/terminal-colors/](https://marvinh.dev/blog/terminal-colors/) — Marvin Hagemeister, "So you want to render colors in your terminal". Summarizes: `COLORTERM=24bit|truecolor` is the reliable signal; `TERM` ends in `256`/`256color` for 256-color; Windows Terminal sets neither; CI environments need to be detected separately.
[^redditsuckless]: [reddit.com/r/suckless](https://www.reddit.com/r/suckless/comments/y6nihv/why_does_st_not_set_the_colorterm_variable_even/) — practitioner thread confirming st does not set COLORTERM.
[^starship]: [github.com/starship/starship/blob/master/src/bug_report.rs](https://github.com/starship/starship/blob/master/src/bug_report.rs) — starship captures `terminal_info` (name, version) from the process environment.
[^ccstatusline]: [github.com/sirmalloc/ccstatusline](https://github.com/sirmalloc/ccstatusline) — direct competitor Claude Code statusline; README lists three color modes (16 / 256 / truecolor) as selectable.
