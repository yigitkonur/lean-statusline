# Prior art: how starship, oh-my-posh, powerlevel10k, ccstatusline handle truecolor

**Scraped:** 2026-04-21
**Relevance:** These are the four most popular prompts / statuslines in the same UI niche as `lean-statusline`. Their decisions on truecolor detection, 256-color fallback, and ANSI-16 support establish the "industry norm" the rewrite can either match or deliberately diverge from.

## oh-my-posh (Go)

### Default: truecolor on

**File:** `src/color/colors.go`, line 30 (via `raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/src/color/colors.go`):

```go
var TrueColor = true
```

### Fallback path: C256 quantization (xterm cube)

**Same file**, ~line 280:

```go
style := color.HEX(colorString, isBackground)
if !style.IsEmpty() {
    if TrueColor {
        return Ansi(style.String())
    }
    return Ansi(style.C256().String())
}
```

`color.C256()` is from `github.com/gookit/color`, which implements the standard xterm 6×6×6 color-cube quantization plus the 24-step grayscale ramp. The algorithm accepts any RGB and emits a byte 0-255 for the closest cube/grayscale slot.

### No separate ANSI-16 code path for hex inputs

oh-my-posh does not ship a "hex → nearest-of-16" fallback. If `TrueColor = false`, hex colors still go through C256 quantization. Users who need ANSI-16 must spell out `lightBlue` or similar named colors in their config, and those names map to `color.Bit4` in gookit/color.

### ANSI escape glyphs oh-my-posh supports inline

From `src/terminal/writer.go`:

```go
knownStyles = []*style{
    {AnchorStart: `<b>`, AnchorEnd: `</b>`, Start: "\x1b[1m",  End: "\x1b[22m"}, // bold
    {AnchorStart: `<u>`, AnchorEnd: `</u>`, Start: "\x1b[4m",  End: "\x1b[24m"}, // underline
    {AnchorStart: `<o>`, AnchorEnd: `</o>`, Start: "\x1b[53m", End: "\x1b[55m"}, // overline
    {AnchorStart: `<i>`, AnchorEnd: `</i>`, Start: "\x1b[3m",  End: "\x1b[23m"}, // italic
    {AnchorStart: `<s>`, AnchorEnd: `</s>`, Start: "\x1b[9m",  End: "\x1b[29m"}, // strikethrough
    {AnchorStart: `<d>`, AnchorEnd: `</d>`, Start: "\x1b[2m",  End: "\x1b[22m"}, // dim
    {AnchorStart: `<f>`, AnchorEnd: `</f>`, Start: "\x1b[5m",  End: "\x1b[25m"}, // blink
    {AnchorStart: `<r>`, AnchorEnd: `</r>`, Start: "\x1b[7m",  End: "\x1b[27m"}, // reverse
}
```

Useful reference for what's safe-to-emit styling alongside color in 2026 terminals. Italic (`\x1b[3m`) and overline (`\x1b[53m`) are less universal than bold/underline.

## powerlevel10k (Zsh)

### Requirement for truecolor

**File:** `github.com/romkatv/powerlevel10k/issues/62`:

> "In order to use true color with Powerlevel10k you need ZSH >= 5.7 and a terminal that supports true color."

### Detection strategy

p10k checks the user's environment for `COLORTERM=truecolor` or `COLORTERM=24bit` and, when present, uses Zsh 5.7+'s native `print -Pr` ability to emit `\x1b[38;2;R;G;Bm` sequences. When `COLORTERM` is not set, p10k refuses to accept hex colors in the config and errors out, forcing the user to use 8-bit ANSI color names.

### Rainbow vs Lean styles

From `no color when using rainbow.` (issue #1818): "Config for Powerlevel10k with 8-color lean prompt style" — p10k ships pre-built configs at multiple levels (lean / rainbow / pure) so users don't re-solve detection. Worth noting as a UX precedent: a terminal tool can ship multiple named palettes and let the user pick based on their terminal, rather than trying to detect perfectly.

## starship (Rust)

### Detection delegated to `nu-ansi-term`

Starship does not ship a bespoke detector — it uses `nu-ansi-term` for color output, which checks `NO_COLOR`, `CLICOLOR_FORCE`, `CLICOLOR`, `TERM`, and `COLORTERM`. Starship's `src/bug_report.rs` captures `terminal_info` for diagnostics but not for output decisions.

### TOML-config hex colors

Starship accepts hex colors (`"#ff0066"`) in module configs. When the terminal does not support truecolor, the output is the RGB escape sequence which gets quantized by the terminal itself (most modern terminals silently quantize unsupported truecolor to their nearest palette color). This is a minimalist, correct approach — delegate the decision to the terminal.

## ccstatusline (TypeScript — direct `lean-statusline` competitor)

From README scrape:

> "Advanced Color Support - Basic (16), 256-color (with custom ANSI codes), and truecolor (with hex codes) modes"

ccstatusline exposes all three modes as user-selectable config, not auto-detected. The user picks their mode when setting up the statusline. This is a defensible UX: it off-loads the detection problem to the human in charge.

## Summary table

| Tool | Default | Fallback implementation | User override |
|---|---|---|---|
| **oh-my-posh** | Truecolor (`TrueColor = true`) | C256 quantization via gookit/color | Implicit (disable truecolor via config) |
| **powerlevel10k** | 8-color lean | Requires `COLORTERM=truecolor` to enable hex | User picks `lean`/`rainbow`/`pure` during `p10k configure` |
| **starship** | Truecolor (delegated to `nu-ansi-term`) | Terminal-side quantization | `NO_COLOR`, `CLICOLOR`, `CLICOLOR_FORCE` |
| **ccstatusline** | User-chosen at install | Three discrete modes | `basic` / `256` / `truecolor` config field |
| **lean-statusline** (current) | Truecolor unconditional | None (no 256 or 16 fallback) | `NO_COLOR`, `LEAN_STATUSLINE_NO_COLOR` |

## Recommendation for the rewrite

**Model: oh-my-posh + `--color` flag.**

- Default: truecolor.
- Config field `colorMode: "auto" | "truecolor" | "256" | "16" | "none"` where `"auto"` follows the algorithm in `00-findings.md §3`.
- If the user picks `"256"`, quantize via the standard xterm-cube formula at render time. Ship this as a ~30-line helper in `lib/colors.mjs`. It's the only cheap way to make the statusline look OK for the rare user with a 256-color-capable-but-not-truecolor terminal, and it's trivial.
- No dedicated 16-color mode. In 2026, the terminals limited to 16 colors (Linux TTY, DEC vt100 emulators, some ancient SSH clients) do not need Claude Code statuslines to be pretty — they need them to be readable, which is a job for the icon/ASCII fallback in `pickIcons()`.
