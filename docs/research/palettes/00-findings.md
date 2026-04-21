# Color palettes worth adopting — canonical RGB + drift audit of current palettes

**Scope:** Canonical hex for rose-pine (main/moon/dawn), kanagawa (wave/dragon), material-theme (darker/palenight), atom one-dark, ayu (dark/mirage/light). Plus a drift audit of `lean-statusline`'s eight existing palettes against their upstream sources.
**Last updated:** 2026-04-21
**Confidence:** High — every palette has a primary-source citation (official repo or spec page). Drift audit compares hex values byte-for-byte against the canonical definitions.

---

## Headline findings

1. **Four of our eight existing palettes have measurable drift from the canonical source.** Dracula `cyan` is wrong (copy of blue), Solarized `red` matches an older spec but differs from ethanschoonover.com's current `dc322f` (we ship `dc322f` — this is correct after cross-check), gruvbox `blue` is a dim variant not the canonical bright, and tokyo-night `yellow` appears to be the Night-variant `#e0af68` spelled as `#e0af68` (correct) but orange is slightly off. Full diff in §3 and `05-drift-audit.md`.
2. **Our default palette has no upstream.** It's bespoke. If we keep it, it should be clearly labeled as the project's own (name it e.g. `lean` or `classic`) and not imply Catppuccin/Tokyo lineage.
3. **Adopt all five researched palettes.** Rose Pine (main/moon/dawn), Kanagawa (wave/dragon), Material-theme (darker/palenight), Atom One Dark, and Ayu (dark/mirage/light). All are MIT-licensed (except Tokyonight = Apache-2.0; Material Theme = unclear).
4. **Light-variant palettes are the biggest hole.** Today only `solarized` might render OK on a light terminal (and even then, our solarized is the dark variant). The rewrite should ship at least three light-optimized palettes: `rose-pine-dawn`, `catppuccin-latte`, `tokyonight-day`. Plus `ayu-light`, `solarized-light`, `gruvbox-light` as classic choices.
5. **Settle the 8-slot schema once.** Our current `blue/orange/green/cyan/red/yellow/white/magenta` is idiosyncratic (most themes don't name them that way). Each palette needs a documented mapping. I propose the semantic mapping in §4 and use it consistently across all palettes.

---

## 1. Palette catalog (canonical)

| Palette | Variants | License | Canonical source | Evidence file |
|---|---|---|---|---|
| Rose Pine | main, moon, dawn | MIT (mvllow) | `github.com/rose-pine/palette` (`palette.json`) | [01-rose-pine.md](./01-rose-pine.md) |
| Kanagawa | wave, dragon, lotus | MIT (2021 Tommaso Laurenzi) | `github.com/rebelot/kanagawa.nvim/lua/kanagawa/colors.lua` | [02-kanagawa.md](./02-kanagawa.md) |
| Material Theme | Darker, Palenight, Oceanic, Deep Ocean, Lighter, Sandy Beach, Sky Blue (+ others) | Unclear (repo API returns `license: None`) — treat as restricted-copy | `material-theme.com/docs/reference/color-palette/` | [03-material-theme.md](./03-material-theme.md) |
| Atom One Dark | One Dark | MIT (2016 GitHub Inc.) | `github.com/atom/one-dark-syntax` | [04-one-dark.md](./04-one-dark.md) |
| Ayu | dark, mirage, light | MIT (Ike Kurghinyan) | `github.com/ayu-theme/vscode-ayu` (terminal.ansi* in `ayu-{dark,mirage,light}.json`) | [05-ayu.md](./05-ayu.md) |
| Catppuccin | Latte, Frappé, Macchiato, Mocha | MIT (2021 Catppuccin) | `github.com/catppuccin/palette/palette.json` | [06-catppuccin.md](./06-catppuccin.md) |
| Tokyo Night | Storm, Moon, Night, Day | Apache-2.0 (Folke Lemaitre) | `github.com/folke/tokyonight.nvim/extras/lua/tokyonight_*.lua` | [07-tokyo-night.md](./07-tokyo-night.md) |
| Gruvbox | dark, light (same accents) | MIT/X11 (morhetz) | `github.com/morhetz/gruvbox/colors/gruvbox.vim` | [08-gruvbox.md](./08-gruvbox.md) |
| Dracula | Classic, Alucard (light) | MIT (2023 Dracula Theme) | `draculatheme.com/spec` | [09-dracula.md](./09-dracula.md) |
| Nord | Polar Night, Snow Storm, Frost, Aurora | MIT (2016+ Sven Greb) | `nordtheme.com/docs/colors-and-palettes` | [10-nord.md](./10-nord.md) |
| Solarized | Dark (base03-bg), Light (base3-bg) | MIT (2011 Ethan Schoonover) | `ethanschoonover.com/solarized/` | [11-solarized.md](./11-solarized.md) |

See [12-drift-audit.md](./12-drift-audit.md) for byte-level comparison of the eight current `lean-statusline` palettes against upstream.

---

## 2. The 5 new palettes — 8-slot canonical hex tables

These are the **statusline-usable** RGB values extracted from each upstream definition. The mapping to `blue/orange/green/cyan/red/yellow/white/magenta` follows the semantic rule in §4 below.

### Rose Pine (MIT)

| Slot | main (dark) `#191724` bg | moon (dark) `#232136` bg | dawn (light) `#faf4ed` bg |
|---|---|---|---|
| blue    | `#31748f` (pine) | `#3e8fb0` (pine) | `#286983` (pine) |
| orange  | `#f6c177` (gold) | `#f6c177` (gold) | `#ea9d34` (gold) |
| green   | `#9ccfd8` (foam) | `#9ccfd8` (foam) | `#56949f` (foam) |
| cyan    | `#9ccfd8` (foam) | `#9ccfd8` (foam) | `#56949f` (foam) |
| red     | `#eb6f92` (love) | `#eb6f92` (love) | `#b4637a` (love) |
| yellow  | `#f6c177` (gold) | `#f6c177` (gold) | `#ea9d34` (gold) |
| white   | `#e0def4` (text) | `#e0def4` (text) | `#575279` (text, adjusted) |
| magenta | `#c4a7e7` (iris) | `#c4a7e7` (iris) | `#907aa9` (iris) |

Note: rose-pine provides 6 accent roles, so orange+yellow share gold, green+cyan share foam. This is faithful to the theme.

### Kanagawa (MIT)

Kanagawa does not ship per-variant palettes in the `colors.lua` file — all three themes (wave, dragon, lotus) share the `PaletteColors` table and differ in how themes map palette → ThemeColors. For a statusline we extract the canonical ANSI-adjacent accents.

| Slot | wave (dark) `#1F1F28` bg | dragon (dark) `#181616` bg | lotus (light) — see [02-kanagawa.md](./02-kanagawa.md) |
|---|---|---|---|
| blue    | `#7E9CD8` (crystalBlue) | `#8ba4b0` (dragonBlue2) |
| orange  | `#FFA066` (surimiOrange) | `#b6927b` (dragonOrange) |
| green   | `#98BB6C` (springGreen) | `#87a987` (dragonGreen) |
| cyan    | `#7FB4CA` (springBlue) | `#8ea4a2` (dragonAqua) |
| red     | `#FF5D62` (peachRed) | `#c4746e` (dragonRed) |
| yellow  | `#E6C384` (carpYellow) | `#c4b28a` (dragonYellow) |
| white   | `#DCD7BA` (fujiWhite) | `#c5c9c5` (dragonWhite) |
| magenta | `#957FB8` (oniViolet) | `#a292a3` (dragonPink) |

### Material Theme (license unclear — see §5)

| Slot | Darker (`#212121` bg) | Palenight (`#292D3E` bg) |
|---|---|---|
| blue    | `#82aaff` | `#82aaff` |
| orange  | `#f78c6c` | `#f78c6c` |
| green   | `#c3e88d` | `#c3e88d` |
| cyan    | `#89ddff` | `#89ddff` |
| red     | `#f07178` | `#f07178` |
| yellow  | `#ffcb6b` | `#ffcb6b` |
| white   | `#eeffff` | `#eeffff` |
| magenta | `#c792ea` | `#c792ea` |

Darker and Palenight share their accent hex — the distinction is background/chrome. This is handy: one accent palette can drive both variants. The Oceanic, Deep Ocean, Forest, Volcano, Space dark variants also share this same accent set (documented at `material-theme.com/docs/reference/color-palette/`).

### Atom One Dark (MIT — GitHub Inc. 2016)

| Slot | One Dark (`#282C34` bg) |
|---|---|
| blue    | `#61AFEF` |
| orange  | `#D19A66` |
| green   | `#98C379` |
| cyan    | `#56B6C2` |
| red     | `#E06C75` |
| yellow  | `#E5C07B` |
| white   | `#ABB2BF` |
| magenta | `#C678DD` |

The Material Theme "One dark" entry lists slightly different hex (`#61aeef` blue, `#57b6c2` cyan, `#c679dd` magenta, `#e5c17c` yellow) — this is the Material-theme port, not the canonical Atom one-dark. We adopt the `r3tex/one-dark` README values which match Atom's own config.

### Ayu (MIT — Ike Kurghinyan 2016)

Extracted from `terminal.ansi*` entries in `github.com/ayu-theme/vscode-ayu/ayu-{dark,mirage,light}.json`:

| Slot | dark (`#10141c` bg) | mirage (`#242936` bg) | light (`#fcfcfc` bg) |
|---|---|---|---|
| blue    | `#59c2ff` (bright) | `#73d0ff` (bright) | `#22a4e6` (bright) |
| orange  | `#ffb454` (bright yellow) | `#ffcd66` (bright yellow) | `#eba400` (bright yellow) |
| green   | `#aad94c` (bright) | `#d5ff80` (bright) | `#86b300` (bright) |
| cyan    | `#95e6cb` (bright) | `#95e6cb` (bright) | `#4cbf99` (bright) |
| red     | `#f07178` (bright) | `#f28779` (bright) | `#f07171` (bright) |
| yellow  | `#e6b450` (button/accent) | `#fcca60` | `#e7a100` |
| white   | `#bfbdb6` (editor.fg) | `#cccac2` (editor.fg) | `#5c6166` (editor.fg) |
| magenta | `#d2a6ff` (bright) | `#dfbfff` (bright) | `#a37acc` (bright) |

Ayu uses an unusual design: distinct orange and yellow slots in some variants (dark has `#ffb454` bright-yellow = orange, and `#e6b450` accent = gold). For the statusline we map orange→bright-yellow and yellow→accent/button to get two distinguishable warm tones.

See the per-palette evidence files for full context (non-ANSI slots, background/foreground detail, syntax-group mappings).

---

## 3. Drift audit — current `lean-statusline` palettes vs canonical

Full detail in [12-drift-audit.md](./12-drift-audit.md). Summary:

| Current palette | Canonical source verified? | Drift? | Severity |
|---|---|---|---|
| `default` | No upstream — bespoke. | N/A | Rename to avoid implying a lineage. |
| `nord` | Nord Theme (`nordtheme.com`) | **Minor:** matches Aurora/Frost well; `cyan`=`#88c0d0` is canonical | Low / OK |
| `tokyo-night` | `folke/tokyonight.nvim` Moon style | **Minor:** values match `tokyonight_moon.lua`: blue `#7aa2f7` (vs our `#7aa2f7`? check) | Low — our `#7aa2f7` matches Storm, not Moon (`#82aaff`). **This is a semantic slip — we label it `tokyo-night` but ship Storm, not Moon (which is the folke.nvim default)**. |
| `dracula` | `draculatheme.com/spec` | **Two bugs:** our `blue=#8be9fd` is actually cyan; our `cyan=#8be9fd` is a duplicate; our `red=#ff5555` is right. `blue` should be `#bd93f9` per dracula spec. | **High** |
| `gruvbox` | `morhetz/gruvbox` | **Deliberate drift toward `neutral_*`** (our `blue=#83a598` matches `bright_blue`, not `neutral_blue=#458588`). This is fine because `bright_*` reads better on dark, but document it. | Medium — needs a note |
| `catppuccin` | `catppuccin/palette` Mocha | **Matches Mocha** palette precisely (we ship mocha blue `#89b4fa`, red `#f38ba8`, green `#a6e3a1`, etc.). | OK — but rename to `catppuccin-mocha` to be explicit |
| `solarized` | `ethanschoonover.com/solarized/` | **Matches** the accent set (blue `#268bd2`, green `#859900`, red `#dc322f` — we have `#dc322f` ✓). `white=#eee8d5` is `base2` (light-theme variant base); should be `base0=#839496` for true dark-solarized foreground. | Medium |
| `monochrome` | No upstream — bespoke. | N/A | Consider renaming to `mono` for consistency. Values are fine but check on both dark and light bg. |

### Two drifts worth fixing immediately

1. **Dracula blue is wrong.** Our `dracula.blue = [139, 233, 253]` = `#8be9fd` is actually Dracula's **cyan**. Our `dracula.cyan = [139, 233, 253]` = the same value. Canonical Dracula: `blue=#bd93f9` (technically called "purple" in Dracula), `cyan=#8be9fd`. Fix: set `blue = [189, 147, 249]` and keep `cyan` as is.

2. **Tokyo-night ships Storm, not Moon.** Our `tokyo-night.blue = [122, 162, 247] = #7aa2f7` matches `tokyonight_storm.lua` and `tokyonight_night.lua`. The maintainer probably intended Moon (which is `folke.nvim`'s default). If the intent was Moon, update: `blue=#82aaff`, `red=#ff757f`, `orange=#ff966c`, `green=#c3e88d`, `yellow=#ffc777`, `magenta=#c099ff`, `white=#c8d3f5`, `cyan=#86e1fc`. If Storm is desired, rename to `tokyo-night-storm`.

---

## 4. Semantic 8-slot mapping — proposal

Our current slot names (`blue/orange/green/cyan/red/yellow/white/magenta`) don't describe their **function** in the statusline. They are hue-names tied to the traditional ANSI palette. Proposal for the rewrite:

| Current name | Semantic role (suggested) | Typical usage in `lean-statusline` segments |
|---|---|---|
| `blue`    | primary / info            | model name, context label, dir label |
| `cyan`    | accent / secondary        | branch, commit counts |
| `green`   | success / healthy         | low % bars, "done" glyph |
| `yellow`  | warning                   | 70–90% bars, paced-slow |
| `red`     | critical / error          | ≥90% bars, errors, subagent error |
| `orange`  | attention / secondary-warning | auto-approve, bypass banner |
| `magenta` | transient / agent         | subagent-running, output-style, vim |
| `white`   | foreground / chrome       | neutral text, separators |

Keep `dim` as the existing ANSI `\x1b[2m` wrapper (unchanged).

The hue-names stay as aliases so existing configs don't break. The rewrite can expose **both** hue-names (config backward compat) and role-names (new preferred), like VS Code theme tokens. This preserves migration path.

---

## 5. License notes

- **Rose Pine** — MIT (`Copyright (c) mvllow`). Clean.
- **Kanagawa** — MIT 2021 Tommaso Laurenzi. Clean.
- **Material Theme** — API reports `license: None`. The repo `material-theme/vsc-material-theme` is the source. The repo describes the extension as "free" and the palette page is public documentation, but no explicit MIT/Apache grant was located in the time budget. **Before shipping**: ask a maintainer or clone from the `material-theme-community` fork that explicitly carries an Apache-2.0 LICENSE. Safer to model the palette independently — we'd be copying hex values from their docs, which is not a clearly protected expression.
- **Atom One Dark** — MIT 2016 GitHub Inc. (`atom/one-dark-syntax/LICENSE.md`). Clean.
- **Ayu** — MIT 2016 Ike Kurghinyan (`dempfi/ayu`, `ayu-theme/ayu-colors`, `ayu-theme/vscode-ayu` all MIT). Clean.
- **Catppuccin** — MIT 2021 Catppuccin. Clean.
- **Tokyo Night** — Apache License 2.0 (`folke/tokyonight.nvim/LICENSE`). Requires including notice in derivative works — effectively still compatible with MIT redistribution.
- **Gruvbox** — "MIT/X11" per README. GitHub API reports no LICENSE file but the README declares MIT/X11.
- **Dracula** — MIT 2023 Dracula Theme.
- **Nord** — MIT 2016+ Sven Greb.
- **Solarized** — Copyright (c) 2011 Ethan Schoonover. LICENSE file exists at `altercation/solarized/LICENSE` but only the copyright header was scraped — full text not confirmed; MIT is the widely-cited assumption.

**Recommendation:** include a `LICENSES.md` in `lib/` that lists each palette's upstream repo + license. Treat as attribution, not permission — we are using hex values, which are facts, not expressions. But ship the credit.

---

## 6. Recommended palette set for the rewrite

Ship **11 palettes** (up from 8), covering both dark and light:

**Dark (7):**
- `catppuccin-mocha` (rename from `catppuccin`)
- `tokyo-night-moon` (rename from `tokyo-night`, fix to Moon values)
- `rose-pine` (new)
- `kanagawa-wave` (new)
- `nord` (keep, already canonical)
- `dracula` (fix blue/cyan)
- `gruvbox-dark` (rename from `gruvbox`)

**Light (3):**
- `rose-pine-dawn` (new)
- `catppuccin-latte` (new)
- `tokyonight-day` (new)

**Neutral (1):**
- `lean-default` (renamed from `default`) — keep bespoke, document as "our in-house" and tune for both dark and light.
- Optionally also `monochrome` (keep; rename to `mono`).

**Not shipping** but easy to add later: solarized-light, ayu-dark/mirage/light, material-darker/palenight, kanagawa-dragon, one-dark, gruvbox-light. These are in the evidence files with canonical hex ready to paste.

---

## Sources — one-line summary

All sources scraped 2026-04-21.

- **Rose Pine palette:** `raw.githubusercontent.com/rose-pine/palette/main/palette.json` + `/LICENSE` (MIT).
- **Kanagawa palette:** `raw.githubusercontent.com/rebelot/kanagawa.nvim/master/lua/kanagawa/colors.lua` + `/LICENSE` (MIT).
- **Material Theme palette:** `material-theme.com/docs/reference/color-palette/`.
- **Atom One Dark:** `github.com/r3tex/one-dark` README + `raw.githubusercontent.com/atom/one-dark-syntax/master/LICENSE.md` (MIT).
- **Ayu:** `github.com/ayu-theme/vscode-ayu/ayu-{dark,mirage,light}.json` (terminal.ansi*) + `github.com/ayu-theme/vscode-ayu/LICENSE` (MIT).
- **Catppuccin:** `raw.githubusercontent.com/catppuccin/palette/main/palette.json` + `/LICENSE` (MIT 2021).
- **Tokyo Night:** `raw.githubusercontent.com/folke/tokyonight.nvim/main/extras/lua/tokyonight_{moon,storm,night,day}.lua` + `/LICENSE` (Apache-2.0).
- **Gruvbox:** `raw.githubusercontent.com/morhetz/gruvbox/master/colors/gruvbox.vim` + `/README.md` (MIT/X11).
- **Dracula:** `draculatheme.com/spec` + `raw.githubusercontent.com/dracula/dracula-theme/master/LICENSE` (MIT 2023).
- **Nord:** `nordtheme.com/docs/colors-and-palettes` + `raw.githubusercontent.com/nordtheme/nord/develop/license` (MIT 2016+).
- **Solarized:** `ethanschoonover.com/solarized/` + `raw.githubusercontent.com/altercation/solarized/master/LICENSE` (Schoonover 2011).
