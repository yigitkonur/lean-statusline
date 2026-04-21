# Rose Pine — canonical palette

**URL:** https://github.com/rose-pine/palette (repo) · https://rosepinetheme.com/palette (site) · `palette.json` at `raw.githubusercontent.com/rose-pine/palette/main/palette.json`
**License:** MIT — `Copyright (c) mvllow` (`raw.githubusercontent.com/rose-pine/palette/main/LICENSE`, scraped 2026-04-21).
**Scraped:** 2026-04-21
**Variants:** `main`, `moon`, `dawn`. The repo confirms: "Rosé Pine includes three variants. These are referenced as Rosé Pine, Rosé Pine Moon, and Rosé Pine Dawn. Their codenames are `main`, `moon`, and `dawn` respectively."

## Canonical hex values (from `palette.json`)

### Rose Pine — `main` (dark; background `#191724`)

| Role | Hex | Use |
|---|---|---|
| base | `#191724` | bg (primary background) |
| surface | `#1f1d2e` | bg-elevated |
| overlay | `#26233a` | bg-popover |
| muted | `#6e6a86` | disabled text, dim |
| subtle | `#908caa` | secondary text |
| text | `#e0def4` | primary foreground |
| love | `#eb6f92` | error / critical |
| gold | `#f6c177` | warning / accent |
| rose | `#ebbcba` | accent (soft) |
| pine | `#31748f` | info / primary accent |
| foam | `#9ccfd8` | success / secondary accent |
| iris | `#c4a7e7` | keyword / agent / transient |

### Rose Pine — `moon` (dark; background `#232136`)

| Role | Hex |
|---|---|
| base | `#232136` |
| surface | `#2a273f` |
| overlay | `#393552` |
| muted | `#6e6a86` |
| subtle | `#908caa` |
| text | `#e0def4` |
| love | `#eb6f92` |
| gold | `#f6c177` |
| rose | `#ea9a97` |
| pine | `#3e8fb0` |
| foam | `#9ccfd8` |
| iris | `#c4a7e7` |

### Rose Pine — `dawn` (light; background `#faf4ed`)

| Role | Hex |
|---|---|
| base | `#faf4ed` |
| surface | `#fffaf3` |
| overlay | `#f2e9e1` |
| muted | `#9893a5` |
| subtle | `#797593` |
| text | `#575279` (scraped from site; `palette.json` shows `#464261`) |
| love | `#b4637a` |
| gold | `#ea9d34` |
| rose | `#d7827e` |
| pine | `#286983` |
| foam | `#56949f` |
| iris | `#907aa9` |

(There is a discrepancy between `palette.json` `text = #464261` and the published site value `#575279`. Both appear in rose-pine ports. `#575279` is the one most ports use; `#464261` is what the JSON file contains. Noting the drift; either is usable.)

## 8-slot statusline mapping

Rose Pine has 6 accent roles (love/gold/rose/pine/foam/iris) vs the 8 slots we need. Sensible assignment:

| Our slot | Semantic | Rose Pine role | main hex | moon hex | dawn hex |
|---|---|---|---|---|---|
| blue | primary/info | pine | `#31748f` | `#3e8fb0` | `#286983` |
| cyan | accent/secondary | foam | `#9ccfd8` | `#9ccfd8` | `#56949f` |
| green | success | foam | `#9ccfd8` | `#9ccfd8` | `#56949f` |
| yellow | warning | gold | `#f6c177` | `#f6c177` | `#ea9d34` |
| orange | attention | gold (same) | `#f6c177` | `#f6c177` | `#ea9d34` |
| red | critical | love | `#eb6f92` | `#eb6f92` | `#b4637a` |
| magenta | transient | iris | `#c4a7e7` | `#c4a7e7` | `#907aa9` |
| white | chrome | text | `#e0def4` | `#e0def4` | `#575279` |

Caveat: green and cyan end up the same hue because rose-pine only has one "cool accent" (foam). If that collapses too much contrast in the statusline, a reasonable alternative is to reuse `pine` (darker-cool) for green on `main` — but this makes green darker than blue which violates the usual bar-color convention (green = low %, red = high %). Ship foam for both; users who want a traditional green can pick another palette.

## Not mapped (unused roles)

- `rose` — soft pink accent; omitted because no 8-slot need.
- `subtle`, `muted` — available as a future `dim2`/`dim3` tier if we expand the schema.
- `base`/`surface`/`overlay`/`highlightLow/Med/High` — background-family; statusline does not paint its own background, so unused.

## Evidence excerpt

From `palette.json` (scraped verbatim):

```
main: base #191724, surface #1f1d2e, overlay #26233a, muted #6e6a86,
      subtle #908caa, text #e0def4, love #eb6f92, gold #f6c177,
      rose #ebbcba, pine #31748f, foam #9ccfd8, iris #c4a7e7

moon: base #232136, surface #2a273f, overlay #393552, muted #6e6a86,
      subtle #908caa, text #e0def4, love #eb6f92, gold #f6c177,
      rose #ea9a97, pine #3e8fb0, foam #9ccfd8, iris #c4a7e7

dawn: base #faf4ed, surface #fffaf3, overlay #f2e9e1, muted #9893a5,
      subtle #797593, text #464261, love #b4637a, gold #ea9d34,
      rose #d7827e, pine #286983, foam #56949f, iris #907aa9
```

From repo README:

> "Rosé Pine includes three variants. These are referenced as Rosé Pine, Rosé Pine Moon, and Rosé Pine Dawn. Their codenames are `main`, `moon`, and `dawn` respectively."

> "Neutral roles: `base`, `surface`, `overlay`, `muted`, `subtle`, `text`, `highlightLow`, `highlightMed`, `highlightHigh`."

> "Accent roles: `love`, `gold`, `rose`, `pine`, `foam`, `iris`."

## License text

```
MIT License

Copyright (c) mvllow

Permission is hereby granted, free of charge, to any person obtaining a copy...
```
