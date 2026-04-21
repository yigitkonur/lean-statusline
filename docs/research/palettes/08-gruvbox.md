# Gruvbox (dark / light) — canonical palette

**URL:** https://github.com/morhetz/gruvbox · `raw.githubusercontent.com/morhetz/gruvbox/master/colors/gruvbox.vim` · `github.com/morhetz/gruvbox-contrib/blob/master/color.table`
**License:** **MIT/X11** per README (`github.com/morhetz/gruvbox/README.md` — scraped 2026-04-21). GitHub API returns `license: None` because no LICENSE file exists at repo root, but the README states "License: MIT/X11".
**Scraped:** 2026-04-21
**Variants:** Dark (`#282828` bg0) and Light (`#fbf1c7` bg0). Same accent hex for both — only bg/fg swap.

## Canonical hex (from `colors/gruvbox.vim`, Last Modified 2017-08-12)

### Dark bg ramp

```
dark0_hard    #1d2021    (most dark)
dark0         #282828    (default dark bg)
dark0_soft    #32302f
dark1         #3c3836
dark2         #504945
dark3         #665c54
dark4         #7c6f64
gray_245      #928374
gray_244      #928374
```

### Light bg ramp

```
light0_hard   #f9f5d7    (most light)
light0        #fbf1c7    (default light bg)
light0_soft   #f2e5bc
light1        #ebdbb2
light2        #d5c4a1
light3        #bdae93
light4        #a89984
```

### Accent colors (same for dark and light)

```
               bright      neutral     faded (dim)
red            #fb4934     #cc241d     #9d0006
green          #b8bb26     #98971a     #79740e
yellow         #fabd2f     #d79921     #b57614
blue           #83a598     #458588     #076678
purple         #d3869b     #b16286     #8f3f71
aqua           #8ec07c     #689d6a     #427b58
orange         #fe8019     #d65d0e     #af3a03
```

Terminal convention:
- **Dark theme** uses `bright_*` for accents against `dark0` bg.
- **Light theme** uses `faded_*` (i.e. "dim" = desaturated) for accents against `light0` bg.
- **`neutral_*`** is the mid-tier, used sparingly for secondary accents on both themes.

## 8-slot statusline mapping

### gruvbox-dark (recommend `bright_*`)

| Slot | Hex |
|---|---|
| blue    | `#83a598` |
| orange  | `#fe8019` |
| green   | `#b8bb26` |
| cyan    | `#8ec07c` (bright_aqua) |
| red     | `#fb4934` |
| yellow  | `#fabd2f` |
| white   | `#ebdbb2` (light1 as fg) |
| magenta | `#d3869b` (bright_purple) |

### gruvbox-light (recommend `faded_*`)

| Slot | Hex |
|---|---|
| blue    | `#076678` |
| orange  | `#af3a03` |
| green   | `#79740e` |
| cyan    | `#427b58` (faded_aqua) |
| red     | `#9d0006` |
| yellow  | `#b57614` |
| white   | `#3c3836` (dark1 as fg) |
| magenta | `#8f3f71` (faded_purple) |

## Drift flag

Our current `gruvbox` palette in `lib/colors.mjs`:

```js
blue:    [131, 165, 152],  // #83a598 — matches bright_blue (correct for dark)
orange:  [254, 128, 25],   // #fe8019 — bright_orange (correct)
green:   [152, 151, 26],   // #98971a — NEUTRAL_green (drift — doc expected bright_green #b8bb26)
cyan:    [104, 157, 106],  // #689d6a — NEUTRAL_aqua (drift — bright_aqua = #8ec07c)
red:     [204, 36, 29],    // #cc241d — NEUTRAL_red (drift — bright_red = #fb4934)
yellow:  [215, 153, 33],   // #d79921 — NEUTRAL_yellow (drift — bright_yellow = #fabd2f)
white:   [235, 219, 178],  // #ebdbb2 — light1 (correct)
magenta: [177, 98, 134],   // #b16286 — NEUTRAL_purple (drift — bright_purple = #d3869b)
```

**We ship a mix** — some slots use `bright_*` (blue, orange, white) and others use `neutral_*` (green, cyan, red, yellow, magenta). This is internally inconsistent.

Recommendation:
- Keep `gruvbox` as a shortcut for `gruvbox-dark`.
- Pick a consistent tier: **`bright_*`** for dark (punchier, legible against `dark0`) or **`neutral_*`** (softer, the gruvbox "retro" feel).
- If the intent was "retro soft", rename the palette to `gruvbox-soft` and document.
- Ship `gruvbox-light` separately using `faded_*` tier.

## License

README text (gruvbox README scraped 2026-04-21):

> "License: MIT/X11"
> → https://en.wikipedia.org/wiki/MIT_License

No standalone LICENSE file in the repo. Crediting in `LICENSES.md` is sufficient.
