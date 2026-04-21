# Nord — canonical palette

**URL:** https://www.nordtheme.com/docs/colors-and-palettes · https://github.com/nordtheme/nord
**License:** MIT — `Copyright (c) 2016-present Sven Greb <development@svengreb.de>` (`raw.githubusercontent.com/nordtheme/nord/develop/license`, scraped 2026-04-21). Default branch: `develop`.
**Scraped:** 2026-04-21
**Palettes:** 4 named sets — Polar Night (dark bg ramp), Snow Storm (light fg ramp), Frost (cool accents), Aurora (warm accents).

## Canonical hex

### Polar Night (dark bg ramp)

```
nord0   #2e3440     (darkest, default bg)
nord1   #3b4252
nord2   #434c5e
nord3   #4c566a     (lightest; comments / muted fg)
```

### Snow Storm (light fg ramp)

```
nord4   #d8dee9     (default fg)
nord5   #e5e9f0
nord6   #eceff4     (lightest — light-theme bg)
```

### Frost (cool accents)

```
nord7   #8fbcbb     (teal; often "cyan")
nord8   #88c0d0     (bright blue; often "blue")
nord9   #81a1c1     (subdued blue)
nord10  #5e81ac     (deep blue)
```

### Aurora (warm accents)

```
nord11  #bf616a     (red)
nord12  #d08770     (orange)
nord13  #ebcb8b     (yellow)
nord14  #a3be8c     (green)
nord15  #b48ead     (purple / magenta)
```

## 8-slot statusline mapping (dark-themed)

| Slot | Hex | Nord token |
|---|---|---|
| blue    | `#5e81ac` | nord10 (deep-blue primary) |
| orange  | `#d08770` | nord12 |
| green   | `#a3be8c` | nord14 |
| cyan    | `#88c0d0` | nord8 (bright-blue-as-cyan) |
| red     | `#bf616a` | nord11 |
| yellow  | `#ebcb8b` | nord13 |
| white   | `#eceff4` | nord6 |
| magenta | `#b48ead` | nord15 |

## Drift check

Our current `lib/colors.mjs` `nord` palette:

```js
'nord': {
    blue:    [129, 161, 193],  // #81a1c1 — nord9 (subdued blue)
    orange:  [208, 135, 112],  // #d08770 — nord12 ✓
    green:   [163, 190, 140],  // #a3be8c — nord14 ✓
    cyan:    [136, 192, 208],  // #88c0d0 — nord8 ✓
    red:     [191, 97, 106],   // #bf616a — nord11 ✓
    yellow:  [235, 203, 139],  // #ebcb8b — nord13 ✓
    white:   [216, 222, 233],  // #d8dee9 — nord4 (default fg, not nord6)
    magenta: [180, 142, 173],  // #b48ead — nord15 ✓
},
```

**Drifts from canonical "brightest" choice:**
- `blue` uses nord9 (`#81a1c1`) instead of nord10 (`#5e81ac`). nord9 is softer; nord10 is the primary Frost deep-blue. Both are valid "Nord blue." Slight preference for nord10 because it stands out better against nord0 bg — **but nord9 is defensible**.
- `white` uses nord4 (`#d8dee9`) instead of nord6 (`#eceff4`). nord4 is the "default fg" per nord docs; this is **correct for a statusline** that wants foreground text (rather than the brightest highlight). Our current choice is better than nord6.

Net: Nord palette has **no critical drift**. Document the `blue=nord9` choice intentionally.

## Notes

- Nord is explicitly a dark-first palette. The Snow Storm ramp is for **use as foreground against Polar Night**, not as a "Nord light theme" — there is no official Nord light. Some community ports do exist (nord-deep-light, etc.) but they are not first-party.
- Nord's color theory aspires to be "tasteful but not vibrant" — all 16 hex fit within a narrow blue-heavy hue range. On a statusline this reads as subdued; not a pain point but means Nord's "red" does not scream like Dracula's.

## License text

```
MIT License (MIT)

Copyright (c) 2016-present Sven Greb <development@svengreb.de> (https://www.svengreb.de)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```
