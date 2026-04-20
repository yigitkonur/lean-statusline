# Can Claude Code render Nerd Font Unicode glyphs in the statusline?

**Scope:** Status of `#49270` (reopen of `#9907`) and whether to rely on Nerd Font PUA codepoints in statusline output.
**Last updated:** 2026-04-18
**Confidence:** High — direct issue read, two-time report over ~6 months, confirmed on latest.

## Answer

**No — broken for the statusline and anywhere else in the Claude Code UI.** Nerd Font / Unicode Private Use Area codepoints (U+E000–U+F8FF, e.g. `` git branch, `` file) render as blank spaces or boxes, even when the host terminal is running a patched Nerd Font and renders them correctly everywhere else (tested in same iTerm2 pane, same font). Original report `#9907` was closed stale 2025-10-19; `#49270` is a fresh reopen on 2026-04-16, **currently open**, labeled `bug / platform:macos / area:tui / area:statusline`. No fix in 2.1.x. Workaround: fall back to "regular" Unicode (emoji, box-drawing, block elements U+2580–U+259F) which DO render correctly.

## Evidence

- Issue: [`#49270`](https://github.com/anthropics/claude-code/issues/49270), state: open, opened 2026-04-16, updated 2026-04-16, 2 comments, labels `bug / platform:macos / area:tui / area:statusline`.
- Original precedent: [`#9907`](https://github.com/anthropics/claude-code/issues/9907) — closed stale 2025-10-19 after 7 days inactivity. Re-report is explicit ("This is a reopen of #9907… still present as of April 2026").
- Affected surfaces (per OP): statusline custom scripts, chat messages (assistant/user), file views (Starship/Alacritty/Kitty configs all display blank where icons are present — causes debug time on correct configs).
- Environment verified: macOS, iTerm2 with JetBrains Mono Nerd Font — "same profile renders Nerd Fonts correctly outside Claude Code".
- Control reproduction in OP: `printf " branch"` (U+E0A0) rendered in the same terminal outside Claude Code shows the icon; inside the Claude Code statusline it shows blank.
- Bot-flagged duplicates: `#9907` (the original), `#6870` (Apple logo U+F8FF not rendered — also PUA range), `#48805` (feature request for font-family setting in desktop app). OP commenter Liquidmasl acknowledged but did not close — the cluster is consistent, not truly duplicate reports.
- No 2.1.x changelog entry mentions Nerd Font, PUA, or Unicode font rendering.

### Documented vs inferred

- **Documented:** Nerd Font PUA codepoints don't render in Claude Code UI; regular Unicode (emoji, box-drawing, etc.) do render.
- **Inferred:** likely cause is Ink's width-calculation layer. Ink uses `string-width` (via `get-east-asian-width` / `emoji-regex`), which treats PUA codepoints as width-0 unless explicitly classified. Result: the character is "there" in the buffer but Ink allocates 0 cells and subsequent paint overwrites it. Regular Unicode (emoji, box-drawing) is classified correctly.

## Caveats / Negative Signal

- Some users report Nerd Font icons rendering fine in `~/.claude/statusline.sh` output — those reports are typically using "legacy" (pre-v3) Nerd Font codepoints in the non-PUA range, or have a fallback font configured at the terminal level that maps PUA to an emoji/icon font. The bug is PUA-range-specific.
- Even if you avoid PUA, width-calculation for CJK and variable-width emoji can also drift — see also `#46841` (status bar icons render as tofu in Kitty terminal despite font support) which is open.
- Portable statusline output should default to ASCII + block elements (U+2580–U+259F) + geometric shapes (U+25A0–U+25FF) — these are all BMP, classified as width-1 or width-2, and render across all Claude Code terminals verified.

## Impact on statusline ideas

- Any idea relying on Nerd Font glyphs as a primary signal — **not doable as a default**. Can ship as opt-in ("set `STATUSLINE_ICONS=nerdfont` to enable"), must default to plain Unicode.
- Powerline-style separators (, , etc. — U+E0B0–U+E0B7 range, PUA) — affected, use box-drawing (`│`, `▏`, `▎`) instead.
- Git branch/PR icons — affected, use plain `git:` text label or a standard Unicode symbol like `⎇` (U+2387) or `❯` (U+276F) which are BMP and render.

## Sources

- `anthropics/claude-code#49270` — 2026-04-16 — primary reopen.
- `anthropics/claude-code#9907` — closed stale 2025-10-19 — original report.
- `anthropics/claude-code#6870` — Apple logo U+F8FF — related PUA family.
- `anthropics/claude-code#46841` — status bar icons render as tofu in Kitty — open, related font/width issue.
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — no mention of font support or PUA handling, suggesting it is not a supported surface.
