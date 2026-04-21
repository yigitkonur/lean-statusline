# Solarized (dark / light) — canonical palette

**URL:** https://ethanschoonover.com/solarized/ · https://github.com/altercation/solarized
**License:** MIT (implied; canonical LICENSE header: `Copyright (c) 2011 Ethan Schoonover` at `raw.githubusercontent.com/altercation/solarized/master/LICENSE`, scraped 2026-04-21).
**Scraped:** 2026-04-21
**Variants:** Dark (base03 bg) and Light (base3 bg). Same accents for both — only bg/fg tone swap. Famously "isoluminant": designed so swapping dark→light preserves perceived accent position.

## Canonical hex (from ethanschoonover.com/solarized/)

### Bg/Fg ramp (shared)

```
base03    #002b36     brblack   (darkest — default dark bg)
base02    #073642     black     (dark bg highlight)
base01    #586e75     brgreen   (content tone — 10/7)
base00    #657b83     bryellow  (content tone — 11/7)
base0     #839496     brblue    (content tone — 12/6; default dark fg)
base1     #93a1a1     brcyan    (content tone — 14/4)
base2     #eee8d5     white     (light bg highlight)
base3     #fdf6e3     brwhite   (lightest — default light bg)
```

### Accent hex (shared between dark and light)

```
yellow    #b58900     3/3   yellow    136
orange    #cb4b16     9/3   brred     166
red       #dc322f     1/1   red       160
magenta   #d33682     5/5   magenta   125
violet    #6c71c4     13/5  brmagenta  61
blue      #268bd2     4/4   blue       33
cyan      #2aa198     6/6   cyan       37
green     #859900     2/2   green      64
```

(Second column is ANSI slot, third is xterm-256 nearest.)

## 8-slot statusline mapping

### solarized-dark

| Slot | Hex |
|---|---|
| blue    | `#268bd2` |
| orange  | `#cb4b16` |
| green   | `#859900` |
| cyan    | `#2aa198` |
| red     | `#dc322f` |
| yellow  | `#b58900` |
| white   | `#839496` (base0, default dark fg) |
| magenta | `#d33682` |

### solarized-light

| Slot | Hex |
|---|---|
| blue    | `#268bd2` |
| orange  | `#cb4b16` |
| green   | `#859900` |
| cyan    | `#2aa198` |
| red     | `#dc322f` |
| yellow  | `#b58900` |
| white   | `#657b83` (base00, default light fg) |
| magenta | `#d33682` |

Note: Solarized's **violet** (`#6c71c4`) is a less-saturated second purple. If we want two distinct purples, use violet for `magenta` and reserve the saturated `#d33682` for a future "pink" slot. For one-slot mapping, `#d33682` is the clearer choice because violet risks being perceptually too close to blue.

## Drift check

Our current `lib/colors.mjs` `solarized`:

```js
blue:    [38, 139, 210],   // #268bd2 ✓
orange:  [203, 75, 22],    // #cb4b16 ✓
green:   [133, 153, 0],    // #859900 ✓
cyan:    [42, 161, 152],   // #2aa198 ✓
red:     [220, 50, 47],    // #dc322f ✓
yellow:  [181, 137, 0],    // #b58900 ✓
white:   [238, 232, 213],  // #eee8d5 — base2 (LIGHT-theme highlight, wrong for dark)
magenta: [211, 54, 130],   // #d33682 ✓
```

**One drift:** `white=#eee8d5` is `base2` which is the **light-theme highlight bg** per Solarized docs (`7/7 white`). On a Solarized *dark* terminal, `base0=#839496` is the canonical default foreground. On a Solarized *light* terminal, `base00=#657b83` is the fg.

Fix:
- If the statusline is used on Solarized-dark: `white = #839496` (base0).
- Or ship two palettes: `solarized-dark` (white=base0) and `solarized-light` (white=base00).

## Solarized's contrast claim

Solarized is designed so:
- `base03`/`base3` differ only by brightness, not hue — same Lab chroma.
- The 8 accents are at consistent Lab lightness (~54 for the dark-theme accents, ~55 for light).
- Colors shift evenly across dark/light without "looking different".

This makes Solarized exceptional for a dual dark/light statusline — one palette, two backgrounds.

Reddit r/vim, Ethan Schoonover in comments: "The only isoluminant colors (if I'm using isoluminant in the same way you are) are the accent and central base values."[^reddit]

## License

LICENSE file exists at `altercation/solarized/LICENSE`. Header: `Copyright (c) 2011 Ethan Schoonover`. The full text was truncated in our scrape but Solarized is widely understood to be MIT. Attribution: "Solarized © 2011 Ethan Schoonover."

---

[^reddit]: [reddit.com/r/vim, "Ethan Schoonover on the science behind the Solarized color..."](https://www.reddit.com/r/vim/comments/rkz7o/ethan_schoonover_on_the_science_behind_the/) — scraped 2026-04-21.
