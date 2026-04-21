# Material Theme (Darker, Palenight, Oceanic, …) — canonical palette

**URL:** https://material-theme.com/docs/reference/color-palette/
**License:** **Unclear.** `github.com/material-theme/vsc-material-theme` API reports `license: None`; no explicit LICENSE file was found in the top-level tree. The palette itself (hex values) is a matter of fact, not copyrightable expression, so we can ship the hex; attribution is still owed.
**Scraped:** 2026-04-21
**Variants scraped:** Oceanic, Darker, Lighter, Palenight, Deep ocean, Forest, Sky blue, Sandy beach, Volcano, Space (all first-party Material variants), plus third-party: Monokai Pro, Dracula, Github (light+dark), Arc dark, One dark, One light, Solarized (dark+light), Night owl, Light owl, Moonlight, Synthwave '84.

## Canonical hex tables

### Oceanic (`#263238` bg)

```
Background: #263238   Foreground: #B0BEC5   Text: #607D8B
Green:  #c3e88d   Yellow:  #ffcb6b   Blue:   #82aaff   Red:    #f07178
Purple: #c792ea   Orange:  #f78c6c   Cyan:   #89ddff   Gray:   #546e7a
White/Black: #eeffff   Error: #ff5370
Accent: #009688
```

### Darker (`#212121` bg)

```
Background: #212121   Foreground: #B0BEC5   Text: #727272
Green:  #c3e88d   Yellow:  #ffcb6b   Blue:   #82aaff   Red:    #f07178
Purple: #c792ea   Orange:  #f78c6c   Cyan:   #89ddff   Gray:   #616161
White/Black: #eeffff   Error: #ff5370
Accent: #FF9800
```

### Palenight (`#292D3E` bg)

```
Background: #292D3E   Foreground: #A6ACCD   Text: #676E95
Green:  #c3e88d   Yellow:  #ffcb6b   Blue:   #82aaff   Red:    #f07178
Purple: #c792ea   Orange:  #f78c6c   Cyan:   #89ddff   Gray:   #676E95
White/Black: #eeffff   Error: #ff5370
Accent: #ab47bc
```

### Deep Ocean (`#0F111A` bg)

```
Background: #0F111A   Foreground: #8F93A2   Text: #4B526D
Green:  #c3e88d   Yellow:  #ffcb6b   Blue:   #82aaff   Red:    #f07178
Purple: #c792ea   Orange:  #f78c6c   Cyan:   #89ddff   Gray:   #717CB4
White/Black: #eeffff   Error: #ff5370
Accent: #84ffff
```

### Lighter (`#FAFAFA` bg)

```
Background: #FAFAFA   Foreground: #546E7A   Text: #94A7B0
Green:  #91b859   Yellow:  #f6a434   Blue:   #6182b8   Red:    #e53935
Purple: #7c4dff   Orange:  #f76d47   Cyan:   #39adb5   Gray:   #AABFC9
White/Black: #272727   Error: #e53935
Accent: #00BCD4
```

### Sandy beach (`#FFF8ED` bg) — light

```
Background: #FFF8ED   Foreground: #546E7A   Text: #888477
Green:  #91b859   Yellow:  #f6a434   Blue:   #6182b8   Red:    #e53935
Purple: #7c4dff   Orange:  #f76d47   Cyan:   #39adb5   Gray:   #888477
White/Black: #272727   Error: #e53935
Accent: #53c7f0
```

## 8-slot statusline mapping (Darker as canonical dark)

| Slot | Hex | Origin |
|---|---|---|
| blue    | `#82aaff` | Blue |
| orange  | `#f78c6c` | Orange |
| green   | `#c3e88d` | Green |
| cyan    | `#89ddff` | Cyan |
| red     | `#f07178` | Red |
| yellow  | `#ffcb6b` | Yellow |
| white   | `#eeffff` | White/Black |
| magenta | `#c792ea` | Purple |

All four "core dark" Material variants (Oceanic, Darker, Palenight, Deep Ocean) share the exact same accent hex — the distinction is only background/foreground/chrome. So one accent palette serves all dark Material variants; the `*-bg` / `*-fg` are what you'd change per variant.

## Notes

- Material-theme's "One dark" entry shows subtly different hex from the canonical Atom one-dark: `#61aeef` (vs `#61AFEF`), `#57b6c2` (vs `#56B6C2`), `#c679dd` (vs `#C678DD`), `#e5c17c` (vs `#E5C07B`). These are within ±2 per channel — likely a manual rounding/transcription drift in the Material theme. **Use Atom's own `one-dark-syntax` repo as the one-dark canonical, not Material's port.**
- The Material Theme Oceanic accent `#009688` is a teal; it's a UI accent (active tabs) not a syntax slot. Don't map it to `cyan`.
- Orange `#f78c6c` and Red `#f07178` are close enough that on some terminals they become indistinguishable. This is a known Material pain point — consider swapping Material's orange for a slightly more saturated hue if the rewrite wants better contrast between warning (orange) and critical (red) states.

## License caveat

The GitHub API reports `license: None` for `github.com/material-theme/vsc-material-theme`. Before shipping a `material-darker` or `material-palenight` palette, consider:
1. Ship under our own MIT and credit the palette author (Mattia Astorino) in `LICENSES.md`.
2. Alternatively, independently re-derive from a clearly-licensed fork such as `material-theme-community/jetbrains` if one exists with explicit Apache/MIT.
3. The hex values themselves are facts not protected by copyright; the arrangement and choice of token names is the thin creative layer.

This is not legal advice; worth a pragmatic check with the maintainer.
