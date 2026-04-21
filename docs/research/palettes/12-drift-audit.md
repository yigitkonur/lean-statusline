# Drift audit — `lean-statusline/lib/colors.mjs` vs upstream canonicals

**Scope:** Compare each of the 8 current palettes byte-for-byte to the upstream canonical values established in files `01-` through `11-`.
**Last updated:** 2026-04-21
**Method:** Read `lib/colors.mjs` (current HEAD), extract RGB tuples, convert to hex, compare against canonical hex for each palette's intended variant.

## Legend

- `✓` — matches canonical to the byte.
- `~` — within ±2 per channel (likely rounding; semantically OK).
- `✗` — different hex, same hue family (defensible divergence).
- `✗✗` — different hex and different hue (bug).
- `[variant]` — we ship this variant of a multi-variant palette, not another.

## default (bespoke — no upstream)

| Slot | Ours | Comment |
|---|---|---|
| blue | `#0099ff` | Punchy modern blue; bespoke. |
| orange | `#ffb055` | Bespoke. |
| green | `#00af50` | Pure saturated green; bespoke. |
| cyan | `#56b6c2` | Matches **Atom one-dark cyan** (!). Possibly a copy-paste. |
| red | `#ff5555` | Matches Dracula red. |
| yellow | `#e6c800` | Bespoke; low contrast on light bg. |
| white | `#dcdcdc` | Bespoke neutral. |
| magenta | `#b48cff` | Bespoke. |

**Finding:** No upstream to drift from. Our `default` is a chimera — cyan matches Atom, red matches Dracula, others bespoke. Rename to `lean` or `classic` and document as the project's own palette. No change to RGB necessary, just labeling.

## nord [Aurora + Frost accents]

| Slot | Ours | Canonical | Diff |
|---|---|---|---|
| blue    | `#81a1c1` | `#5e81ac` (nord10) | `✗` — nord9 instead of nord10 |
| orange  | `#d08770` | `#d08770` (nord12) | `✓` |
| green   | `#a3be8c` | `#a3be8c` (nord14) | `✓` |
| cyan    | `#88c0d0` | `#88c0d0` (nord8)  | `✓` |
| red     | `#bf616a` | `#bf616a` (nord11) | `✓` |
| yellow  | `#ebcb8b` | `#ebcb8b` (nord13) | `✓` |
| white   | `#d8dee9` | `#d8dee9` (nord4) | `✓` (correct as fg) |
| magenta | `#b48ead` | `#b48ead` (nord15) | `✓` |

**Severity: Low.** Nord palette is essentially canonical; the only choice is nord9 (softer blue) vs nord10 (deeper). Either is defensible. **No fix needed.**

## tokyo-night [ships Storm/Night values, not Moon]

| Slot | Ours | Moon (recommended) | Storm/Night (what we have) |
|---|---|---|---|
| blue    | `#7aa2f7` | `#82aaff` | `#7aa2f7` |
| orange  | `#ff9e64` | `#ff966c` | `#ff9e64` |
| green   | `#9ece6a` | `#c3e88d` | `#9ece6a` |
| cyan    | `#7dcfff` | `#86e1fc` | `#7dcfff` |
| red     | `#f7768e` | `#ff757f` | `#f7768e` |
| yellow  | `#e0af68` | `#ffc777` | `#e0af68` |
| white   | `#c0caf5` | `#c8d3f5` | `#c0caf5` |
| magenta | `#bb9af7` | `#c099ff` | `#bb9af7` |

**Severity: Medium — semantic mislabel.** We call it `tokyo-night` (no qualifier). The `folke/tokyonight.nvim` **default style is `moon`**. Users expecting "Tokyo Night" get Storm.

**Fix options:**
1. Rename to `tokyo-night-storm` (or just `tokyonight-storm`), add new `tokyo-night` (Moon) and `tokyo-night-night` (Night), add `tokyo-night-day` (light).
2. Keep label `tokyo-night` and update the RGB to Moon values.

Recommended: (2) — matches user expectation; keep Storm as an optional `tokyo-night-storm` alias.

## dracula [two bugs]

| Slot | Ours | Canonical | Diff |
|---|---|---|---|
| blue    | `#8be9fd` | `#bd93f9` (Dracula "purple") | `✗✗` |
| orange  | `#ffb86c` | `#ffb86c` | `✓` |
| green   | `#50fa7b` | `#50fa7b` | `✓` |
| cyan    | `#8be9fd` | `#8be9fd` | `✓` (but duplicates blue slot) |
| red     | `#ff5555` | `#ff5555` | `✓` |
| yellow  | `#f1fa8c` | `#f1fa8c` | `✓` |
| white   | `#f8f8f2` | `#f8f8f2` | `✓` |
| magenta | `#bd93f9` | `#ff79c6` (Dracula "pink") | `✗✗` |

**Severity: High.** `blue` and `magenta` are swapped. The `blue` slot ships cyan. After the swap of `blue`↔`magenta`, all 8 slots become distinct and canonical.

**Fix (required):**
```js
'dracula': {
    blue:    [189, 147, 249],   // #bd93f9  — was magenta
    orange:  [255, 184, 108],
    green:   [80, 250, 123],
    cyan:    [139, 233, 253],
    red:     [255, 85, 85],
    yellow:  [241, 250, 140],
    white:   [248, 248, 242],
    magenta: [255, 121, 198],   // #ff79c6  — was blue (wrongly)
},
```

## gruvbox [internally inconsistent tier mix]

| Slot | Ours | Bright tier | Neutral tier | What we ship |
|---|---|---|---|---|
| blue    | `#83a598` | `#83a598` | `#458588` | **bright** |
| orange  | `#fe8019` | `#fe8019` | `#d65d0e` | **bright** |
| green   | `#98971a` | `#b8bb26` | `#98971a` | **neutral** |
| cyan    | `#689d6a` | `#8ec07c` | `#689d6a` | **neutral** |
| red     | `#cc241d` | `#fb4934` | `#cc241d` | **neutral** |
| yellow  | `#d79921` | `#fabd2f` | `#d79921` | **neutral** |
| white   | `#ebdbb2` | (light1) | — | light1 — bg ramp |
| magenta | `#b16286` | `#d3869b` | `#b16286` | **neutral** |

**Severity: Medium — internal inconsistency.** 3 slots (`blue`, `orange`, `white`) are bright-tier; 5 slots (`green`, `cyan`, `red`, `yellow`, `magenta`) are neutral-tier. Looks like a transcription mistake — someone picked `bright_blue` and `bright_orange` but then used `neutral_*` for the rest.

**Fix:** Pick one tier and stick to it. For a dark statusline, `bright_*` reads better against `dark0` bg. Adopt:

```js
'gruvbox': {
    blue:    [131, 165, 152],  // #83a598 bright
    orange:  [254, 128, 25],   // #fe8019 bright
    green:   [184, 187, 38],   // #b8bb26 bright
    cyan:    [142, 192, 124],  // #8ec07c bright
    red:     [251, 73, 52],    // #fb4934 bright
    yellow:  [250, 189, 47],   // #fabd2f bright
    white:   [235, 219, 178],  // #ebdbb2 light1
    magenta: [211, 134, 155],  // #d3869b bright
},
```

If the intent was "soft retro" (what current neutral-biased values give), rename to `gruvbox-soft`.

## catppuccin [Mocha — correct]

| Slot | Ours | Mocha canonical | Diff |
|---|---|---|---|
| blue    | `#89b4fa` | `#89b4fa` | `✓` |
| orange  | `#fab387` | `#fab387` (peach) | `✓` |
| green   | `#a6e3a1` | `#a6e3a1` | `✓` |
| cyan    | `#89dceb` | `#89dceb` (sky) | `✓` |
| red     | `#f38ba8` | `#f38ba8` | `✓` |
| yellow  | `#f9e2af` | `#f9e2af` | `✓` |
| white   | `#cdd6f4` | `#cdd6f4` (text) | `✓` |
| magenta | `#cba6f7` | `#cba6f7` (mauve) | `✓` |

**Severity: None — all slots canonical Mocha.** Action: **rename `catppuccin` to `catppuccin-mocha`** to make the variant explicit, so we can add `catppuccin-latte` etc. later.

## solarized [one drift]

| Slot | Ours | Canonical | Diff |
|---|---|---|---|
| blue    | `#268bd2` | `#268bd2` | `✓` |
| orange  | `#cb4b16` | `#cb4b16` | `✓` |
| green   | `#859900` | `#859900` | `✓` |
| cyan    | `#2aa198` | `#2aa198` | `✓` |
| red     | `#dc322f` | `#dc322f` | `✓` |
| yellow  | `#b58900` | `#b58900` | `✓` |
| white   | `#eee8d5` | `#839496` (base0) | `✗` — we ship base2 (light-theme bg tone) |
| magenta | `#d33682` | `#d33682` | `✓` |

**Severity: Medium.** `white=#eee8d5` is `base2`, which is Solarized's light-theme highlight bg — **wrong slot for a "white" foreground role**. For a Solarized-dark user, canonical default fg is `base0=#839496`. For Solarized-light user, fg is `base00=#657b83`.

**Fix:** Set `white = [131, 148, 150]` (`#839496`) for the `solarized` (dark) palette. Add a new `solarized-light` with `white = [101, 123, 131]` (`#657b83`).

## monochrome (bespoke)

| Slot | Ours | Comment |
|---|---|---|
| blue    | `#bebebe` | Gray |
| orange  | `#d2d2d2` | Lighter gray |
| green   | `#e6e6e6` | Lightest |
| cyan    | `#c8c8c8` | Mid gray |
| red     | `#f5f5f5` | Near-white |
| yellow  | `#e1e1e1` | Near-light |
| white   | `#fafafa` | Maximum |
| magenta | `#afafaf` | Darker |

**Finding:** Pure grayscale ramp. No upstream to drift from. One observation: the ramp is not ordered by semantic (red=critical is NOT the brightest in typical statusline conventions; green=healthy is brighter than red in this palette). On a light terminal background, `monochrome` is unusable — all slots fall within ±30 lightness of `#ffffff`.

**Recommendation:** Either ship two monochrome variants (`mono-dark` for dark bg, `mono-light` for light bg), or one "smart" mono that uses the terminal's inherited fg color (an SGR 39 "default foreground" reset) and varies only dim/bold instead of RGB.

---

## Summary of required fixes before rewrite ships

| Palette | Required | Defensible (user pref) |
|---|---|---|
| `default` | Rename to `lean` or `classic`. No RGB change. | |
| `nord` | — | blue=nord9 vs nord10 is user pref |
| `tokyo-night` | Rename + update to Moon, OR rename to `tokyo-night-storm` | |
| `dracula` | **Fix blue/magenta swap** | |
| `gruvbox` | Pick one tier (bright vs neutral) and stick to it | |
| `catppuccin` | Rename to `catppuccin-mocha` | |
| `solarized` | **Fix `white=base0` not `base2`** | |
| `monochrome` | Consider `mono-dark` vs `mono-light` or SGR-39 | |

## Palettes to add

- `catppuccin-latte` (light)
- `rose-pine` / `rose-pine-moon` / `rose-pine-dawn`
- `kanagawa-wave` / `kanagawa-dragon`
- `tokyo-night-day` (light)
- `ayu-dark` / `ayu-mirage` / `ayu-light`
- `gruvbox-light`
- `solarized-light`
- `one-dark`

All documented with canonical hex in the sibling files (`01-` through `11-`).
