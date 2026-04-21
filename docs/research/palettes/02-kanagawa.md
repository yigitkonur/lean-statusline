# Kanagawa — canonical palette

**URL:** https://github.com/rebelot/kanagawa.nvim · palette at `raw.githubusercontent.com/rebelot/kanagawa.nvim/master/lua/kanagawa/colors.lua`
**License:** MIT — `Copyright (c) 2021 Tommaso Laurenzi` (`raw.githubusercontent.com/rebelot/kanagawa.nvim/master/LICENSE`, scraped 2026-04-21).
**Scraped:** 2026-04-21
**Variants:** `wave` (dark, default), `dragon` (darker, red-less), `lotus` (light).

## Canonical palette hex (PaletteColors from `colors.lua`)

Kanagawa's `colors.lua` defines one big PaletteColors table shared across themes. Each theme file (`themes/wave.lua`, `dragon.lua`, `lotus.lua`) then maps palette entries to ThemeColors. The excerpts below are the palette-level RGBs with the prefix indicating which theme the token is "for".

### `wave` (dark, `#1F1F28` bg)

Extracted from `PaletteColors`:

```
fujiWhite     #DCD7BA   — main foreground
oldWhite      #C8C093   — secondary text
sumiInk0..6   #16161D..#54546D   — bg ramp (dark→lighter)
waveBlue1     #223249
waveBlue2     #2D4F67
winterGreen   #2B3328
winterYellow  #49443C
winterRed     #43242B
winterBlue    #252535
waveAqua1     #6A9589   — muted green
waveAqua2     #7AA89F
springViolet1 #938AA9   — lavender
springViolet2 #9CABCA
springBlue    #7FB4CA   — cyan
lightBlue     #A3D4D5
springGreen   #98BB6C   — green
sakuraPink    #D27E99
waveRed       #E46876
peachRed      #FF5D62   — red
surimiOrange  #FFA066   — orange
katanaGray    #717C7C
fujiGray      #727169
oniViolet     #957FB8   — magenta / purple
oniViolet2    #b8b4d0
crystalBlue   #7E9CD8   — blue
boatYellow1   #938056
boatYellow2   #C0A36E
carpYellow    #E6C384   — yellow
autumnGreen   #76946A
autumnRed     #C34043
autumnYellow  #DCA561
samuraiRed    #E82424
roninYellow   #FF9E3B
dragonBlue    #658594
```

### `dragon` (darker, red-less; `#181616` bg)

```
dragonBlack0..6  #0d0c0c..#625e5a   — bg ramp
dragonWhite      #c5c9c5   — main foreground
dragonGreen      #87a987   — green
dragonGreen2     #8a9a7b
dragonPink       #a292a3   — magenta (pink)
dragonOrange     #b6927b   — orange
dragonOrange2    #b98d7b
dragonGray       #a6a69c
dragonGray2      #9e9b93
dragonGray3      #7a8382
dragonBlue2      #8ba4b0   — blue
dragonViolet     #8992a7
dragonRed        #c4746e   — red
dragonAqua       #8ea4a2   — cyan
dragonAsh        #737c73
dragonTeal       #949fb5
dragonYellow     #c4b28a   — yellow
```

### `lotus` (light)

```
lotusInk1        #545464
lotusInk2        #43436c
lotusGray        #dcd7ba
lotusGray2       #716e61
lotusGray3       #8a8980
lotusWhite0..5   #d5cea3..#e4d794
lotusViolet1..4  #a09cac, #766b90, #c9cbd1, #624c83
lotusBlue1..5    #c7d7e0, #b5cbd2, #9fb5c9, #4d699b, #5d57a3
lotusGreen       #6f894e   — green
lotusGreen2      #6e915f
lotusGreen3      #b7d0ae
lotusPink        #b35b79   — magenta (pink)
lotusOrange      #cc6d00   — orange
lotusOrange2     #e98a00
lotusYellow      #77713f
lotusYellow2     #836f4a
lotusYellow3     #de9800   — yellow
lotusYellow4     #f9d791
lotusRed         #c84053   — red
lotusRed2        #d7474b
lotusRed3        #e82424
lotusRed4        #d9a594
lotusAqua        #597b75   — cyan
lotusAqua2       #5e857a
lotusTeal1..3    #4e8ca2, #6693bf, #5a7785
lotusCyan        #d7e3d8
```

## 8-slot statusline mapping

### `wave`

| Slot | Palette token | Hex |
|---|---|---|
| blue    | crystalBlue  | `#7E9CD8` |
| orange  | surimiOrange | `#FFA066` |
| green   | springGreen  | `#98BB6C` |
| cyan    | springBlue   | `#7FB4CA` |
| red     | peachRed     | `#FF5D62` |
| yellow  | carpYellow   | `#E6C384` |
| white   | fujiWhite    | `#DCD7BA` |
| magenta | oniViolet    | `#957FB8` |

### `dragon`

| Slot | Palette token | Hex |
|---|---|---|
| blue    | dragonBlue2   | `#8ba4b0` |
| orange  | dragonOrange  | `#b6927b` |
| green   | dragonGreen   | `#87a987` |
| cyan    | dragonAqua    | `#8ea4a2` |
| red     | dragonRed     | `#c4746e` |
| yellow  | dragonYellow  | `#c4b28a` |
| white   | dragonWhite   | `#c5c9c5` |
| magenta | dragonPink    | `#a292a3` |

### `lotus`

| Slot | Palette token | Hex |
|---|---|---|
| blue    | lotusTeal1  | `#4e8ca2` |
| orange  | lotusOrange | `#cc6d00` |
| green   | lotusGreen  | `#6f894e` |
| cyan    | lotusAqua   | `#597b75` |
| red     | lotusRed    | `#c84053` |
| yellow  | lotusYellow3| `#de9800` |
| white   | lotusInk1   | `#545464` |
| magenta | lotusPink   | `#b35b79` |

## Notes

- Kanagawa's naming scheme is intentionally poetic (spring/autumn/winter/sakura). This is aesthetic, not functional — the `colors.lua` defines the colors, `themes/*.lua` ties them to semantic terminal slots. Our statusline doesn't need the poetic names.
- `dragon` is designed for maximum dark comfort: muted hues, barely-there red. Good choice for a statusline because the muted palette sits better alongside Claude Code's own chrome without visual competition.
- `lotus` is rare in the ecosystem — fewer ports exist than for `wave`. But the hex is canonical and stable.

## License text

```
MIT License

Copyright (c) 2021 Tommaso Laurenzi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```
