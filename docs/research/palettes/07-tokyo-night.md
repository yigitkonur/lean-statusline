# Tokyo Night (Storm / Moon / Night / Day) — canonical palette

**URL:** https://github.com/folke/tokyonight.nvim · theme files at `raw.githubusercontent.com/folke/tokyonight.nvim/main/extras/lua/tokyonight_{storm,moon,night,day}.lua`
**License:** **Apache-2.0** — `raw.githubusercontent.com/folke/tokyonight.nvim/main/LICENSE` (scraped 2026-04-21). This is a departure from most themes which are MIT. Apache-2.0 still permits redistribution; requires including the notice file.
**Scraped:** 2026-04-21
**Variants:** `storm` (dark, lightest), `moon` (dark, default), `night` (dark, blackest), `day` (light).

## Canonical hex (from `tokyonight_*.lua`)

### tokyonight_storm (`#24283b` bg, `#c0caf5` fg)

```
blue     #7aa2f7
cyan     #7dcfff
green    #9ece6a
yellow   #e0af68
orange   #ff9e64
red      #f7768e
magenta  #bb9af7
purple   #9d7cd8
fg       #c0caf5
```

Terminal mappings:
```
black          #1d202f     black_bright   #414868
blue           #7aa2f7     blue_bright    #8db0ff
cyan           #7dcfff     cyan_bright    #a4daff
green          #9ece6a     green_bright   #9fe044
magenta        #bb9af7     magenta_bright #c7a9ff
red            #f7768e     red_bright     #ff899d
white          #a9b1d6     white_bright   #c0caf5
yellow         #e0af68     yellow_bright  #faba4a
```

### tokyonight_moon (`#222436` bg, `#c8d3f5` fg) — the default

```
blue     #82aaff
blue1    #65bcff
blue2    #0db9d7
blue5    #89ddff   (operator color)
cyan     #86e1fc
green    #c3e88d
yellow   #ffc777
orange   #ff966c
red      #ff757f
magenta  #c099ff
purple   #fca7ea
teal     #4fd6be
fg       #c8d3f5
comment  #636da6
```

Terminal mappings:
```
black          #1b1d2b     black_bright   #444a73
blue           #82aaff     blue_bright    #9ab8ff
cyan           #86e1fc     cyan_bright    #b2ebff
green          #c3e88d     green_bright   #c7fb6d
magenta        #c099ff     magenta_bright #caabff
red            #ff757f     red_bright     #ff8d94
white          #828bb8     white_bright   #c8d3f5
yellow         #ffc777     yellow_bright  #ffd8ab
```

### tokyonight_night (`#1a1b26` bg, `#c0caf5` fg)

```
blue     #7aa2f7
cyan     #7dcfff
green    #9ece6a
yellow   #e0af68
orange   #ff9e64
red      #f7768e
magenta  #bb9af7
purple   #9d7cd8
fg       #c0caf5
```

Terminal mappings:
```
black          #15161e     black_bright   #414868
blue           #7aa2f7     blue_bright    #8db0ff
cyan           #7dcfff     cyan_bright    #a4daff
green          #9ece6a     green_bright   #9fe044
magenta        #bb9af7     magenta_bright #c7a9ff
red            #f7768e     red_bright     #ff899d
white          #a9b1d6     white_bright   #c0caf5
yellow         #e0af68     yellow_bright  #faba4a
```

**Storm and Night share the same accent hex** (blue `#7aa2f7`, red `#f7768e`, etc.) — only backgrounds differ. This is useful: one accent set can drive both variants.

### tokyonight_day (`#e1e2e7` bg, `#3760bf` fg) — light

```
blue     #2e7de9
cyan     #007197
green    #587539
yellow   #8c6c3e
orange   #b15c00
red      #f52a65
magenta  #9854f1
purple   #7847bd
fg       #3760bf   (note: foreground is saturated blue, not grey)
comment  #848cb5
```

Terminal mappings:
```
black          #b4b5b9     black_bright   #a1a6c5
blue           #2e7de9     blue_bright    #358aff
cyan           #007197     cyan_bright    #007ea8
green          #587539     green_bright   #5c8524
magenta        #9854f1     magenta_bright #a463ff
red            #f52a65     red_bright     #ff4774
white          #6172b0     white_bright   #3760bf
yellow         #8c6c3e     yellow_bright  #a27629
```

Day additionally exposes a **rainbow palette** for differentiated tokens:

```
rainbow = { #2e7de9, #8c6c3e, #587539, #118c74, #9854f1, #7847bd, #b15c00, #f52a65 }
```

## 8-slot statusline mapping

### Moon (recommended default)

| Slot | Hex |
|---|---|
| blue    | `#82aaff` |
| orange  | `#ff966c` |
| green   | `#c3e88d` |
| cyan    | `#86e1fc` |
| red     | `#ff757f` |
| yellow  | `#ffc777` |
| white   | `#c8d3f5` |
| magenta | `#c099ff` |

### Storm (alt dark)

| Slot | Hex |
|---|---|
| blue    | `#7aa2f7` |
| orange  | `#ff9e64` |
| green   | `#9ece6a` |
| cyan    | `#7dcfff` |
| red     | `#f7768e` |
| yellow  | `#e0af68` |
| white   | `#c0caf5` |
| magenta | `#bb9af7` |

### Day (light)

| Slot | Hex |
|---|---|
| blue    | `#2e7de9` |
| orange  | `#b15c00` |
| green   | `#587539` |
| cyan    | `#007197` |
| red     | `#f52a65` |
| yellow  | `#8c6c3e` |
| white   | `#3760bf` |
| magenta | `#9854f1` |

## Drift flag

Our current `lib/colors.mjs` `tokyo-night` palette ships:
```js
blue:    [122, 162, 247],  // #7aa2f7 ← Storm/Night value
orange:  [255, 158, 100],  // #ff9e64 ← Storm/Night value
green:   [158, 206, 106],  // #9ece6a ← Storm/Night value
cyan:    [125, 207, 255],  // #7dcfff ← Storm/Night value
red:     [247, 118, 142],  // #f7768e ← Storm/Night value
yellow:  [224, 175, 104],  // #e0af68 ← Storm/Night value
white:   [192, 202, 245],  // #c0caf5 ← Storm/Night value
magenta: [187, 154, 247],  // #bb9af7 ← Storm/Night value
```

**These are Storm (or Night) values, not Moon.** But `folke/tokyonight.nvim`'s **default** style is `moon` (as of the version scraped). Two ways to resolve:

1. Keep the label `tokyo-night` and update to Moon values (blue `#82aaff`, red `#ff757f`, etc.) — matches what users expect when they say "Tokyo Night."
2. Rename to `tokyo-night-storm` and keep the current Storm values.

Recommended: **(1)** — ship Moon under the `tokyo-night` label (so it matches user expectations) and add `tokyo-night-storm` as a separate palette for users who prefer the lighter storm variant.

## Apache-2.0 License implications

Apache-2.0 requires:
1. Include the full LICENSE text or a pointer to it.
2. State any modifications to the original.
3. Preserve the NOTICE file if one exists (folke/tokyonight.nvim does not have a NOTICE file at repo root — only LICENSE).
4. Derivative works can be MIT or any compatible license, but the Apache'd portion must remain under Apache.

For a statusline that ships hex values (facts, not expressions), the practical obligation is **credit** — include "Tokyo Night colors: Folke Lemaitre, Apache-2.0" in `LICENSES.md`. No further copyleft ripple.
