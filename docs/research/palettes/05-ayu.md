# Ayu (dark / mirage / light) — canonical palette

**URL:** https://github.com/dempfi/ayu (Sublime Text origin) · https://github.com/ayu-theme/vscode-ayu (VS Code port — `terminal.ansi*` JSON) · https://github.com/ayu-theme/ayu-colors (palette package)
**License:** MIT — `Copyright (c) 2016 Ike Kurghinyan` (`raw.githubusercontent.com/ayu-theme/vscode-ayu/master/LICENSE`, scraped 2026-04-21).
**Scraped:** 2026-04-21
**Variants:** `dark`, `mirage`, `light`.

## Canonical hex (terminal.ansi* extracted from VS Code theme JSON)

Source files: `github.com/ayu-theme/vscode-ayu/{ayu-dark,ayu-mirage,ayu-light}.json`.

### ayu-dark (`#10141c` bg, `#bfbdb6` fg)

```
terminal.ansiBlack          #1b1f29
terminal.ansiRed            #f06b73
terminal.ansiGreen          #70bf56
terminal.ansiYellow         #fdb04c
terminal.ansiBlue           #4fbfff
terminal.ansiMagenta        #d0a1ff
terminal.ansiCyan           #93e2c8
terminal.ansiWhite          #c7c7c7
terminal.ansiBrightRed      #f07178
terminal.ansiBrightGreen    #aad94c
terminal.ansiBrightYellow   #ffb454
terminal.ansiBrightBlue     #59c2ff
terminal.ansiBrightMagenta  #d2a6ff
terminal.ansiBrightCyan     #95e6cb
```

### ayu-mirage (`#242936` bg, `#cccac2` fg)

```
terminal.ansiBlack          #171b24
terminal.ansiRed            #f28273
terminal.ansiGreen          #87d96c
terminal.ansiYellow         #fcca60
terminal.ansiBlue           #6acdff
terminal.ansiMagenta        #ddbbff
terminal.ansiCyan           #93e2c8
terminal.ansiWhite          #c7c7c7
terminal.ansiBrightRed      #f28779
terminal.ansiBrightGreen    #d5ff80
terminal.ansiBrightYellow   #ffcd66
terminal.ansiBrightBlue     #73d0ff
terminal.ansiBrightMagenta  #dfbfff
terminal.ansiBrightCyan     #95e6cb
```

### ayu-light (`#fcfcfc` bg, `#5c6166` fg)

```
terminal.ansiBlack          #000000
terminal.ansiRed            #f06b6c
terminal.ansiGreen          #6cbf43
terminal.ansiYellow         #e7a100
terminal.ansiBlue           #21a1e2
terminal.ansiMagenta        #a176cb
terminal.ansiCyan           #4abc96
terminal.ansiWhite          #c7c7c7
terminal.ansiBrightRed      #f07171
terminal.ansiBrightGreen    #86b300
terminal.ansiBrightYellow   #eba400
terminal.ansiBrightBlue     #22a4e6
terminal.ansiBrightMagenta  #a37acc
terminal.ansiBrightCyan     #4cbf99
```

## 8-slot statusline mapping

Ayu's non-ANSI design philosophy: saturated accent yellows (`#e6b450` dark / `#fcca60` mirage / `#e7a100` light) plus distinct bright-yellow (`#ffb454` = orange). We map:

- `orange` → ayu's accent yellow (the "button" hue that appears in UI accents)
- `yellow` → ayu's bright-yellow

### ayu-dark

| Slot | Hex | Source |
|---|---|---|
| blue    | `#59c2ff` | ansiBrightBlue |
| orange  | `#e6b450` | editor button/accent (from theme JSON) |
| green   | `#aad94c` | ansiBrightGreen |
| cyan    | `#95e6cb` | ansiBrightCyan |
| red     | `#f07178` | ansiBrightRed |
| yellow  | `#ffb454` | ansiBrightYellow |
| white   | `#bfbdb6` | editor.foreground |
| magenta | `#d2a6ff` | ansiBrightMagenta |

### ayu-mirage

| Slot | Hex |
|---|---|
| blue    | `#73d0ff` |
| orange  | `#ffad66` (derive from button; `ffcc66` is the true accent) |
| green   | `#d5ff80` |
| cyan    | `#95e6cb` |
| red     | `#f28779` |
| yellow  | `#ffcd66` |
| white   | `#cccac2` |
| magenta | `#dfbfff` |

### ayu-light

| Slot | Hex |
|---|---|
| blue    | `#22a4e6` |
| orange  | `#fa8d3e` (from accent; true button is `#e7a100`) |
| green   | `#86b300` |
| cyan    | `#4cbf99` |
| red     | `#f07171` |
| yellow  | `#eba400` |
| white   | `#5c6166` |
| magenta | `#a37acc` |

## Notes

- Ayu's design explicitly uses a single "accent" orange/yellow (`#e6b450` dark) for UI framing — this doesn't map to "yellow" as warning in the classic sense. When mapping to a statusline where yellow means "warning (70-90%)", use `#ffb454` dark / `#ffcd66` mirage / `#eba400` light.
- `ansiWhite = #c7c7c7` in all three variants is a placeholder; the real "white" / foreground is `editor.foreground` (`#bfbdb6` dark, `#cccac2` mirage, `#5c6166` light). Use those.
- Ayu-light is the rarer light palette in the wild. It's well-tuned — the palette has good contrast on its `#fcfcfc` near-white background.

## License text

```
MIT License

Copyright (c) 2016 Ike Kurghinyan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```
