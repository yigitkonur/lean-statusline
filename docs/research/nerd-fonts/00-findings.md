# Nerd Fonts landscape — detection, glyph set, curated icons for `lean-statusline`

**Scope:** Current Nerd Fonts version, glyph ranges, detection feasibility from a spawned shell process, curated 40-icon list with exact Unicode codepoints, and Symbols-Only variant tradeoff.
**Last updated:** 2026-04-21
**Confidence:** High — sourced from the Nerd Fonts GitHub releases page, nerdfonts.com cheat-sheet, the `Glyph Sets and Code Points` wiki, and the `8bitmcu/NerdFont-Cheat-Sheet` CSV export.

---

## Headline findings

1. **Latest release: v3.4.0 ("Easter Release without Eggs"), 2025-04-24.**[^releases] Per-family count: **~55 patched font families** (not an official count; this was inferred from the release archive listing). Nerd Fonts v3.4 continues to be backward-compatible with v3.0+ cheat sheets. v3.x introduced a large Material Design codepoint migration (`F500+ nf-mdi-*` → `F0001+ nf-md-*`) — both remain available in v3.x but `nf-mdi-*` is deprecated.[^glyph-ranges]
2. **Detection from a shell is not reliable.** The Nerd Fonts maintainer's position: "I believe there is no general way to do this." Terminal emulators typically do not expose the active font to child processes, and fontconfig probes (`fc-list`, `fc-match`) only reveal what's *installed* — not what's *active in the current terminal*.[^detection-answer] The practical approach is to let users opt-in via config and fall back to ASCII on genuine low-capability environments (the approach `lean-statusline` already uses in `pickIcons()`).
3. **Symbols-only variant (`Symbols Nerd Font Mono`) is the winning compromise for users who don't want to change their programming font.** It adds every Nerd Fonts icon as a fallback font — the user keeps JetBrains Mono / Fira Code / SF Mono / Cascadia Code as their primary and enables Symbols NF as a secondary/fallback.[^symbols-only] Recommend this in the README.
4. **Ship ~40 curated icons mapping to our current 21-icon `ICONS_UNICODE` + typical git/language/system statusline needs.** Every icon has a citable codepoint from `nerdfonts.com/cheat-sheet`. Use the `Material Design Icons` (`nf-md-*`, codepoint `F0001` – `F1AF0`) for new icons where possible because that set is the most comprehensive and least likely to shift codepoints in future releases.[^glyph-ranges]

---

## 1. Nerd Fonts current version

From `github.com/ryanoasis/nerd-fonts/releases` (scraped 2026-04-21):

> **v3.4.0 — Easter Release without Eggs**  
> "Mainly a font update release. No surprises here (we hope)."  
> Release date (per `nerdfonts.com/releases`): **2025-04-24**

Breaking changes in v3.4.0:

> "Remove patcher option `--use-single-width-glyphs` (use `-s` or `--mono` instead)"

Key improvements:

> "The patched fonts in `otf` format are now much smaller (comparable to `ttf`)"  
> "Add Adwaita Mono", "Add Atkinson Hyperlegible Mono", "Update Iosevka to 33.2.1"

**Note on release process:** The `FontPatcher.zip` in the v3.4.0 release was initially the old v3.3.0 version — this was corrected on 2025-05-21 (issue #1868). For palette/icon research this is irrelevant; the font archives themselves were correct from release day.

The **downstream linux distro signal** confirms v3.4 is current:

> "Commits on 2025-12-11: media-fonts/symbols-nerd-font: keyword 3.4. Commits on 2025-06-05: media-fonts/symbols-nerd-font: drop 3.3." — Gentoo packages changelog[^gentoo]

## 2. Patched-font family count

The release notes do not state a total count. The releases page lists these (scraped families, partial, from v3.4.0 release page):

```
0xProto, 3270, Adwaita (v3.4.0+), Agave, AnonymousPro, Arimo, Atkinson Hyperlegible (v3.4.0+), AurulentSansMono,
BigBlueTerminal, BitstreamVeraSansMono, CascadiaCode, CascadiaMono, CodeNewRoman, ComicShannsMono, CommitMono,
Cousine, D2Coding, DaddyTimeMono, DejaVuSansMono, DroidSansMono, EnvyCodeR, FantasqueSansMono, FiraCode, FiraMono,
GeistMono, Gohu, Go-Mono, Hack, Hasklig, HeavyData, Hermit, iA-Writer, IBMPlexMono, Inconsolata, InconsolataGo,
InconsolataLGC, IntelOneMono, Iosevka, IosevkaTerm, IosevkaTermSlab, JetBrainsMono, Lekton, …
```

Plus (from `nerdfonts.com/font-downloads` prior scrape): Lilex, Martian Mono, Meslo, Monaspace, Mononoki, MPlus, Monoid, Noto (Sans and Serif), Roboto Mono, SauceCode, ShureTech, SpaceMono, Terminus, Tinos, Ubuntu, Ubuntu Mono, Ubuntu Sans, VictorMono.

**Estimated count: ~55–60 patched families** in v3.4.0. The count is not officially published. FreeBSD's `x11-fonts/nerd-fonts` ports description says "over 20 developer-targeted, patched fonts" — that number is stale. Other distros use ranges like "25+" or "50+". Cite the 55 figure as "approximately", not precisely.

## 3. Glyph ranges (from the wiki, v3.3.0-aligned, stable through v3.4)

From `github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points` (scraped 2026-04-21):

| Set | Codepoint range | Prefix |
|---|---|---|
| Seti-UI + Custom     | `e5fa` – `e6b7`                        | `nf-custom-` / `nf-seti-` |
| Devicons             | `e700` – `e8ef`                        | `nf-dev-` |
| Font Awesome         | `ed00` – `f2ff` (with two gaps)        | `nf-fa-` |
| Font Awesome Extension | (inside FA range)                    | `nf-fae-` |
| Material Design Icons | `f0001` – `f1af0`                     | `nf-md-` |
| Weather              | `e300` – `e3e3`                        | `nf-weather-` |
| Octicons             | `f400` – `f533`, `2665`, `26A1`        | `nf-oct-` |
| Powerline Symbols    | `e0a0` – `e0a2`, `e0b0` – `e0b3`       | `nf-pl-` |
| Powerline Extra      | (separate range within powerline)      | `nf-ple-` |
| Pomicons             | `e000` – `e00a`                        | `nf-pom-` |
| Codicons             | `ea60` – `ec1e`                        | `nf-cod-` |
| Font Logos           | `f300` – `f381`                        | `nf-linux-` |
| IEC Power Symbols    | `23fb` – `23fe`, `2b58`                | `nf-iec-` |

Notes:

- **Material Design Icons** moved in v2→v3 from `F500+ nf-mdi-*` to `F0001+ nf-md-*`. For maximum forward-compat, use `nf-md-*` only.[^glyph-ranges]
- **Font Awesome v6** has two small codepoint gaps from the v5→v6 migration; see the v3.2.1 migration table in the releases notes for the 17 affected glyphs.
- **Codicons** (`ea60`-`ec1e`) is the VSCode icon set — broad coverage of UI/IDE icons, well-maintained.
- **Octicons** (`f400`-`f533`) is the GitHub icon set — the canonical choice for git-related glyphs.

## 4. Detection — can we sniff "user has a Nerd Font active"?

**Short answer: No, not reliably.**

From the authoritative Nerd Fonts discussion #829 (scraped 2026-04-21):

> "_no_"  
> "I believe there is no general way to do this."  
> "There might be a terminal specific way to do it, but I deem even that unlikely."  
> "You would at least need to find out which font is the main used font. Then you could check yourself with system tools. That would ignore system wide font fallback (if supported). And then there are terminal emulators that support multiple active fonts for different codepoint ranges."  
> "I guess this is somehow like 'has the user a color terminal or not?' of old. It was (is?) not really possible to determine that."[^detection-answer]

The thread suggests two partial workarounds:

1. **`NERD_FONT=1` env var convention.** One maintainer comment proposes "Should there be a convention of using a specific env variable to mean 'I am using a nerd font'? Like `export NERD_FONT=1`?" — this is not a shipped standard, just a suggestion. `lean-statusline` can adopt it unilaterally: `LEAN_STATUSLINE_NERD=1` is a reasonable user opt-in.
2. **Query fontconfig, with caveats.** `fc-list | grep -i nerd` or `fc-match Mono` reveals what's installed/default **system-wide**, not what's active in the terminal. A terminal like Kitty can have a totally different font config than fontconfig's default. False positive rate: **high** (installed ≠ active). False negative rate: **moderate** (correctly installed fonts may not match by name; e.g. "JetBrainsMono Nerd Font" vs "JetBrains Mono Nerd Font" vs "JetBrainsMonoNerdFont-Regular").

### Practical detection strategy for `lean-statusline`

```
1. If LEAN_STATUSLINE_NERD is set (0 or 1) → honor it.
2. If LEAN_STATUSLINE_ICONS=nerd is set in the config → unicode + nerd glyphs.
3. Otherwise → emit regular Unicode glyphs (our current ICONS_UNICODE) and let nerd-capable users opt in via config.
```

This matches the spirit of `pickIcons()` in `lib/colors.mjs` — conservative allow, with opt-in for nicer icons. Do not build a font-probe system; it will mislead.

### Why other tools don't probe either

- **starship** — no font probe. Users enable nerd icons via config (`format = "$symbol"`).
- **powerlevel10k** — no font probe. `p10k configure` asks the user during setup: "Do you have a Nerd Font installed?"
- **oh-my-posh** — no font probe. Users choose a theme; nerd-font-dependent themes have names like `powerlevel10k_modern.omp.json` to signal the requirement.
- **ccstatusline** (competitor) — no probe; config field.

## 5. Symbols-Only variant

From issue #479:

> "Generate proportional and monospaced variants as with standard Nerd Fonts, i.e. 'Symbols Nerd Font' and 'Symbols Nerd Font Mono'."  
> "This would allow users to select the proportional font for use outside of monospaced contexts (terminal emulators) to get full-size icons. For example, in window manager status bars."[^symbols-only]

The Symbols-Only variant ships **only the patched glyphs** (no letter shapes). Users keep their primary programming font and add `Symbols Nerd Font Mono` as a **fallback font** — most terminals let you configure a primary + fallback:

- **Kitty:** `font_family` + `symbol_map`
- **Alacritty:** `font.normal` + `font.builtin_box_drawing`
- **iTerm2:** "Use a different font for non-ASCII text" → Symbols NF
- **WezTerm:** `font = wezterm.font_with_fallback({'JetBrains Mono', 'Symbols Nerd Font Mono'})`
- **Ghostty:** `font-family = JetBrains Mono` + `font-family = Symbols Nerd Font Mono` (multiple)
- **VSCode terminal:** `terminal.integrated.fontFamily: "JetBrains Mono, 'Symbols Nerd Font Mono'"`
- **Windows Terminal:** font fallback via `profiles.defaults.font.face`

**Recommendation in the `lean-statusline` README:** tell users they **do not need** to replace their primary font. Install `Symbols Nerd Font Mono` and add it as fallback — 30-second setup.

## 6. Curated 40-icon map for `lean-statusline`

Codepoints cited from `nerdfonts.com/cheat-sheet` (via the CSV export at `github.com/8bitmcu/NerdFont-Cheat-Sheet/main/nerdfont.csv`, scraped 2026-04-21).

Format: `name | codepoint | glyph (from Nerd Fonts) | fallback (non-NF Unicode) | usage`

### Core statusline glyphs (already in our ICONS_UNICODE — map to NF equivalents)

| name | NF codepoint | NF class | Unicode fallback | Usage |
|---|---|---|---|---|
| ctx    | `U+F040` (or `F03EB`) | `nf-fa-pencil` | `✎` (U+270E) | context/tokens label |
| timer  | `U+F017` | `nf-fa-clock` | `⏱` (U+23F1) | elapsed time, pace |
| zap    | `U+F0E7` | `nf-fa-bolt` | `⚡` (U+26A1) | live / high-activity |
| refresh | `U+F021` | `nf-fa-refresh` | `⟳` (U+27F3) | paced-slow / refreshing |
| bypass | (none; use ASCII) | — | `▶▶` (U+25B6×2) | bypass banner |
| ssh    | `U+F023` | `nf-fa-lock` | `🔒` (U+1F512) | SSH-connected |
| money  | `U+F155` | `nf-fa-dollar-sign` | `$` (ASCII) | cost / pricing |
| worktree | `U+E725` | `nf-dev-git-branch` | `🌿` (U+1F33F) | worktree indicator |
| agent  | `U+F06A9` | `nf-md-robot` | `🤖` (U+1F916) | agent/subagent |
| warn   | `U+F071` | `nf-fa-warning` | `⚠` (U+26A0) | warning state |
| effortHigh | `U+F111` | `nf-fa-circle` (solid) | `●` (U+25CF) | high-effort model |
| effortMed | `U+F10C` | `nf-fa-circle-o` | `◐` (U+25D0) | medium-effort model |
| effortLow | (degrees dial) | `nf-md-circle_small` | `◔` (U+25D4) | low-effort model |
| barFilled | `U+F111` | `nf-fa-circle` | `●` (U+25CF) | bar filled cell |
| barEmpty | `U+F10C` | `nf-fa-circle-o` | `○` (U+25CB) | bar empty cell |
| rail | — | — | `─` (U+2500) | wide-bar track |
| running | `U+F144` | `nf-fa-circle-play` | `●` (U+25CF) | subagent running |
| done   | `U+F00C` | `nf-fa-check` | `✓` (U+2713) | subagent done |
| error  | `U+F00D` | `nf-fa-times` | `✗` (U+2717) | subagent error |
| paused | `U+F04C` | `nf-fa-pause` | `⏸` (U+23F8) | subagent paused |

### Git-state glyphs (new, for future `git` segment enrichment)

| name | NF codepoint | NF class | Usage |
|---|---|---|---|
| gitBranch    | `U+E725` | `nf-dev-git-branch` | branch name prefix |
| gitCommit    | `U+F417` | `nf-oct-git-commit` | commit counts |
| gitMerge     | `U+F419` | `nf-oct-git-merge`  | merge state |
| gitStaged    | `U+F0EE` | `nf-fa-cloud-upload` | staged files count |
| gitUnstaged  | `U+F040` | `nf-fa-pencil` | unstaged edits |
| gitAhead     | `U+F062` | `nf-fa-arrow-up` | commits ahead of origin |
| gitBehind    | `U+F063` | `nf-fa-arrow-down` | commits behind origin |
| gitStash     | `U+F01C` | `nf-fa-inbox` | stashed changes |

Notes:
- Nerd Fonts Octicons provides `nf-oct-git-branch` at `U+F418` as an alternative; `nf-dev-git-branch` at `U+E725` is visually the classic branch-fork icon.
- There is no canonical "ahead/behind" icon in Nerd Fonts — up/down arrows or `nf-md-arrow-up-bold` / `nf-md-arrow-down-bold` (`U+F0737` / `U+F072E`) are the typical choice.

### Language / tool icons (new, for an optional language-segment)

| name | NF codepoint | NF class |
|---|---|---|
| langNode    | `U+E719` | `nf-dev-nodejs` |
| langPython  | `U+E73C` | `nf-dev-python` |
| langRust    | `U+E7A8` | `nf-dev-rust` |
| langGo      | `U+E65E` | `nf-seti-go` (or `nf-dev-go` `U+E724`) |
| langReact   | `U+E7BA` | `nf-dev-react` |
| langJs      | `U+E781` | `nf-dev-javascript` |
| langTs      | `U+E8CA` | `nf-dev-typescript` |
| toolDocker  | `U+E7B0` | `nf-dev-docker` |
| toolKube    | `U+E81D` | `nf-dev-kubernetes` |
| toolTerm    | `U+F120` | `nf-fa-terminal` |
| toolCloud   | `U+F0C2` | `nf-fa-cloud` |

### Progress / bar alternatives (supplemental)

| name | NF codepoint | Usage |
|---|---|---|
| barDot       | `U+F111` / `●` | circular filled |
| barDotEmpty  | `U+F10C` / `○` | circular empty |
| barBlock     | `U+F0764` (`nf-md-square`) / `█` (U+2588) | block fill |
| powerlineLeft  | `U+E0B2` | powerline left separator |
| powerlineRight | `U+E0B0` | powerline right separator |

---

## 7. Implications for the rewrite

1. **Keep `ICONS_UNICODE` as default**, `ICONS_NERD` as opt-in. User enables it via config (`icons: 'nerd'`), matching the pattern starship/p10k use. Do not build a font-probing detector.
2. **Populate `ICONS_NERD` from the curated 40-icon list above**, using Material Design (`nf-md-*`) or Font Awesome (`nf-fa-*`) codepoints. Avoid Powerline (`nf-pl-*`) codepoints in the core icon map — those require fairly tight font-metric alignment to render well and are less robust in fallback-font setups.
3. **Ship all three tiers** in `lib/colors.mjs`: `ICONS_ASCII` (current), `ICONS_UNICODE` (current), `ICONS_NERD` (new). `pickIcons(mode)` should accept `'ascii' | 'unicode' | 'nerd' | 'auto'`.
4. **Add a `LEAN_STATUSLINE_ICONS=nerd` env override** for one-off enabling (matches the project's existing `LEAN_STATUSLINE_NO_COLOR` pattern).
5. **README must explain the Symbols-Only fallback-font setup.** That's the least friction path for users. See §5 for per-terminal snippets.

---

## Sources

All sources scraped 2026-04-21.

[^releases]: [github.com/ryanoasis/nerd-fonts/releases](https://github.com/ryanoasis/nerd-fonts/releases) — latest release v3.4.0 "Easter Release without Eggs". Release notes mention font updates, Material Design/FontAwesome codepoint handling, breaking removal of `--use-single-width-glyphs`.
[^glyph-ranges]: [github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points](https://github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points) — version-stamped "As of v3.3.0"; codepoint ranges per set. Stable through v3.4.
[^detection-answer]: [github.com/ryanoasis/nerd-fonts/discussions/829](https://github.com/ryanoasis/nerd-fonts/discussions/829) — maintainer answer "no" to the shell-detection question.
[^symbols-only]: [github.com/ryanoasis/nerd-fonts/issues/479](https://github.com/ryanoasis/nerd-fonts/issues/479) — "[Suggestion] Improve icons-only 'Symbols Nerd Font'" — documents the Symbols Nerd Font (Mono) variant's intent.
[^gentoo]: [packages.gentoo.org/packages/media-fonts/symbols-nerd-font](https://packages.gentoo.org/packages/media-fonts/symbols-nerd-font/changelog) — downstream version history confirming v3.4 is current.
