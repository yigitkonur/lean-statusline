# Catppuccin (Latte / Frappé / Macchiato / Mocha) — canonical palette

**URL:** https://catppuccin.com/palette · https://github.com/catppuccin/palette · `raw.githubusercontent.com/catppuccin/palette/main/palette.json`
**License:** MIT — `Copyright (c) 2021 Catppuccin` (`raw.githubusercontent.com/catppuccin/catppuccin/main/LICENSE`, scraped 2026-04-21).
**Scraped:** 2026-04-21
**Variants:** `latte` (light), `frappé` (mid-dark), `macchiato` (darker), `mocha` (darkest, the original).

## Canonical hex (from `palette.json`)

### Latte (light; `#eff1f5` bg, `#4c4f69` text)

| Token | Hex |
|---|---|
| rosewater | `#dc8a78` |
| flamingo  | `#dd7878` |
| pink      | `#ea76cb` |
| mauve     | `#8839ef` |
| red       | `#d20f39` |
| maroon    | `#e64553` |
| peach     | `#fe640b` |
| yellow    | `#df8e1d` |
| green     | `#40a02b` |
| teal      | `#179299` |
| sky       | `#04a5e5` |
| sapphire  | `#209fb5` |
| blue      | `#1e66f5` |
| lavender  | `#7287fd` |
| text      | `#4c4f69` |

### Frappé (darkish; `#303446` bg, `#c6d0f5` text)

| Token | Hex |
|---|---|
| rosewater | `#f2d5cf` |
| flamingo  | `#eebebe` |
| pink      | `#f4b8e4` |
| mauve     | `#ca9ee6` |
| red       | `#e78284` |
| maroon    | `#ea999c` |
| peach     | `#ef9f76` |
| yellow    | `#e5c890` |
| green     | `#a6d189` |
| teal      | `#81c8be` |
| sky       | `#99d1db` |
| sapphire  | `#85c1dc` |
| blue      | `#8caaee` |
| lavender  | `#babbf1` |
| text      | `#c6d0f5` |

### Macchiato (darker; `#24273a` bg, `#cad3f5` text)

| Token | Hex |
|---|---|
| rosewater | `#f4dbd6` |
| flamingo  | `#f0c6c6` |
| pink      | `#f5bde6` |
| mauve     | `#c6a0f6` |
| red       | `#ed8796` |
| maroon    | `#ee99a0` |
| peach     | `#f5a97f` |
| yellow    | `#eed49f` |
| green     | `#a6da95` |
| teal      | `#8bd5ca` |
| sky       | `#91d7e3` |
| sapphire  | `#7dc4e4` |
| blue      | `#8aadf4` |
| lavender  | `#b7bdf8` |
| text      | `#cad3f5` |

### Mocha (darkest; `#1e1e2e` bg, `#cdd6f4` text)

| Token | Hex |
|---|---|
| rosewater | `#f5e0dc` |
| flamingo  | `#f2cdcd` |
| pink      | `#f5c2e7` |
| mauve     | `#cba6f7` |
| red       | `#f38ba8` |
| maroon    | `#eba0ac` |
| peach     | `#fab387` |
| yellow    | `#f9e2af` |
| green     | `#a6e3a1` |
| teal      | `#94e2d5` |
| sky       | `#89dceb` |
| sapphire  | `#74c7ec` |
| blue      | `#89b4fa` |
| lavender  | `#b4befe` |
| text      | `#cdd6f4` |

## 8-slot statusline mapping

Catppuccin has 14 accent roles — it's the richest of our palettes. Mapping to 8 slots requires choices:

| Slot | Semantic | Catppuccin role | Latte | Frappé | Macchiato | Mocha |
|---|---|---|---|---|---|---|
| blue    | primary/info    | blue     | `#1e66f5` | `#8caaee` | `#8aadf4` | `#89b4fa` |
| cyan    | accent          | sky      | `#04a5e5` | `#99d1db` | `#91d7e3` | `#89dceb` |
| green   | success         | green    | `#40a02b` | `#a6d189` | `#a6da95` | `#a6e3a1` |
| yellow  | warning         | yellow   | `#df8e1d` | `#e5c890` | `#eed49f` | `#f9e2af` |
| orange  | attention       | peach    | `#fe640b` | `#ef9f76` | `#f5a97f` | `#fab387` |
| red     | critical        | red      | `#d20f39` | `#e78284` | `#ed8796` | `#f38ba8` |
| magenta | transient       | mauve    | `#8839ef` | `#ca9ee6` | `#c6a0f6` | `#cba6f7` |
| white   | chrome          | text     | `#4c4f69` | `#c6d0f5` | `#cad3f5` | `#cdd6f4` |

Unused accent roles (rosewater, flamingo, pink, maroon, teal, sapphire, lavender) are available for future expansion — e.g. a "paceSlow" signal could use `sapphire` or a "hyperlink" segment could use `lavender`.

## Style-guide excerpts (from `docs/style-guide.md`)

Syntax-role guidance (for reference — not the statusline's concern, but documents authorial intent):

```
Keyword          → Mauve
Strings          → Green
Symbols, Atoms   → Red
Escape/Regex     → Pink
Comments         → Overlay 2
Constants/Numbers → Peach
Operators        → Sky
Methods/Functions → Blue
Parameters       → Maroon
Classes/Types    → Yellow
```

General-role guidance:

```
Cursor              → Rosewater
Line Numbers        → Overlay 1
Active Line Number  → Lavender
Normal Links        → Blue
Errors              → Red
Warnings            → Yellow / Peach
Information         → Teal
```

ANSI bright formulas (from style-guide for Mocha/Macchiato/Frappé):

```
color.lightness × 0.94
color.chroma    + 8
color.hue       + 2
```

For Latte:

```
color.lightness × 1.09
color.hue       + 2
```

ANSI black/white slots (Mocha/Macchiato/Frappé):

```
Black (0)  → Surface 1
Black (8)  → Surface 2
White (7)  → Subtext 0
White (15) → Subtext 1
```

## Notes

- Our current `catppuccin` palette in `lib/colors.mjs` ships the **Mocha** values faithfully (blue `#89b4fa`, red `#f38ba8`, green `#a6e3a1`, yellow `#f9e2af`, magenta `#cba6f7`). Rename to `catppuccin-mocha` for clarity and to make room for adding Latte (light) and possibly Frappe/Macchiato.
- Mocha `yellow=#f9e2af` is extremely light (near-cream) — on a light terminal background this drops to <1.5:1 contrast. **Mocha is a dark-only palette**; if someone uses a light terminal they should use Latte.
- Catppuccin's `version` at scrape time is `1.8.0` in `palette.json`. The hex values are stable across versions for ≥2 years.
