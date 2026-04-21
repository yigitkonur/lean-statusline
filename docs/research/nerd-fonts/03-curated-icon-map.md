# `ICONS_NERD` — the curated 40-icon map with exact codepoints

**Sources:** `nerdfonts.com/cheat-sheet` (the canonical lookup) · `github.com/8bitmcu/NerdFont-Cheat-Sheet/main/nerdfont.csv` (CSV mirror, same data) · `github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points`.
**Scraped:** 2026-04-21
**Purpose:** Drop-in `ICONS_NERD` map for `lib/colors.mjs`, designed to cover the current statusline + a near-term expansion to git/language/system icons.

## Format

Each row shows:
- `key` — the name used in `ICONS_*` object (matches existing keys where applicable).
- `codepoint` — the U+xxxx form.
- `js` — the literal string to embed in a `.mjs` file. Codepoints above `U+FFFF` require the `\u{...}` form, which is supported in modern Node (ES2015+). `lean-statusline` targets Node 20+, so `\u{F0001}` is fine.
- `class` — the Nerd Fonts class name for user lookup on nerdfonts.com.
- `set` — the glyph set (material / font-awesome / octicons / devicons / codicons).

## Core statusline icons — drop-in replacements for ICONS_UNICODE

| key | codepoint | js literal | class | set |
|---|---|---|---|---|
| ctx      | U+F03EB  | `'B'` | `nf-md-pencil`             | material |
| timer    | U+F0954  | `'4'` | `nf-md-clock`              | material |
| zap      | U+F0E7   | `''`  | `nf-fa-bolt`               | font-awesome |
| refresh  | U+F0450  | `'0'` | `nf-md-refresh`            | material |
| bypass   | U+F04E   | `''` (double forward) | `nf-fa-forward` × 2 | font-awesome |
| ssh      | U+F033E  | `'E'` | `nf-md-lock`               | material |
| money    | U+F155   | `''`  | `nf-fa-dollar-sign`        | font-awesome |
| worktree | U+E725   | `''`  | `nf-dev-git-branch`        | devicons |
| agent    | U+F06A9  | `'9'` | `nf-md-robot`              | material |
| warn     | U+F071   | `''`  | `nf-fa-warning`            | font-awesome |

### Effort indicators

| key | codepoint | js literal | class |
|---|---|---|---|
| effortHigh | U+F111  | `''`  | `nf-fa-circle` (solid) |
| effortMed  | U+F111  | `''` (dimmed) or U+F10C (outline) | `nf-fa-circle-o` |
| effortLow  | U+F111  | (dimmed further) or U+F192 `` | `nf-fa-circle-dot` |

Simpler: keep our existing `●/◐/◔` Unicode (`U+25CF/U+25D0/U+25D4`) even in nerd-mode. They render well in any font.

### Bar cells (circular style)

| key | codepoint | js literal | class |
|---|---|---|---|
| barFilled | U+F111 | `''` | `nf-fa-circle` |
| barEmpty  | U+F10C | `''` | `nf-fa-circle-o` |
| rail      | —      | `'─'` (`─`) | (Unicode box drawing) |

### Subagent statuses

| key | codepoint | js literal | class |
|---|---|---|---|
| running | U+F144  | `''`  | `nf-fa-circle-play` |
| done    | U+F00C  | `''`  | `nf-fa-check` |
| error   | U+F00D  | `''`  | `nf-fa-times` |
| paused  | U+F04C  | `''`  | `nf-fa-pause` |

## Git state icons (for future git-aware segments)

| key | codepoint | js literal | class |
|---|---|---|---|
| gitBranch   | U+E725  | `''`  | `nf-dev-git-branch` |
| gitCommit   | U+F417  | `''`  | `nf-oct-git-commit` |
| gitMerge    | U+F419  | `''`  | `nf-oct-git-merge` |
| gitStaged   | U+F0EE  | `''`  | `nf-fa-cloud-upload` |
| gitUnstaged | U+F03EB | `'B'` | `nf-md-pencil` |
| gitAhead    | U+F0737 | `'7'` | `nf-md-arrow-up-bold` |
| gitBehind   | U+F072E | `'E'` | `nf-md-arrow-down-bold` |
| gitStash    | U+F01C  | `''`  | `nf-fa-inbox` |
| gitFork     | U+F126  | `''`  | `nf-fa-code-fork` |

## Language / tool icons (for future language segments)

| key | codepoint | js literal | class |
|---|---|---|---|
| langNode    | U+E719   | `''`   | `nf-dev-nodejs` |
| langPython  | U+E73C   | `''`   | `nf-dev-python` |
| langRust    | U+E7A8   | `''`   | `nf-dev-rust` |
| langGo      | U+E724   | `''`   | `nf-dev-go` (also `nf-seti-go` U+E65E) |
| langReact   | U+E7BA   | `''`   | `nf-dev-react` |
| langJs      | U+E781   | `''`   | `nf-dev-javascript` |
| langTs      | U+E8CA   | `''`   | `nf-dev-typescript` |
| langHtml    | U+E736   | `''`   | `nf-dev-html5` |
| langCss     | U+E749   | `''`   | `nf-dev-css3` |
| toolDocker  | U+E7B0   | `''`   | `nf-dev-docker` |
| toolKube    | U+E81D   | `''`   | `nf-dev-kubernetes` |
| toolTerm    | U+F120   | `''`   | `nf-fa-terminal` |
| toolCloud   | U+F0C2   | `''`   | `nf-fa-cloud` |

## Powerline separators (if adopted)

| key | codepoint | js literal | class |
|---|---|---|---|
| plLeftFilled  | U+E0B0 | `''` | `nf-pl-left-filled` |
| plLeftHollow  | U+E0B1 | `''` | `nf-pl-left-hollow` |
| plRightFilled | U+E0B2 | `''` | `nf-pl-right-filled` |
| plRightHollow | U+E0B3 | `''` | `nf-pl-right-hollow` |

Note: powerline separators require tight font-metric alignment with the surrounding glyphs. They look great with a full Nerd Font but can produce 1px gaps or overlaps with fallback-font setups. **Skip in the default `ICONS_NERD` map**; expose only if the user enables a `nerd+powerline` icons mode.

## Proposed `ICONS_NERD` object (drop-in for `lib/colors.mjs`)

```js
const ICONS_NERD = {
    // Parity with ICONS_UNICODE keys
    ctx:      'B',  // nf-md-pencil
    timer:    '4',  // nf-md-clock
    zap:      '',   // nf-fa-bolt
    refresh:  '0',  // nf-md-refresh
    bypass:   '▶▶',       // keep Unicode; no clean NF equivalent
    ssh:      'E',  // nf-md-lock
    money:    '',   // nf-fa-dollar-sign
    worktree: '',   // nf-dev-git-branch
    agent:    '9',  // nf-md-robot
    warn:     '',   // nf-fa-warning
    effortHigh: '●',      // Unicode renders fine
    effortMed:  '◐',
    effortLow:  '◔',
    barFilled: '',  // nf-fa-circle
    barEmpty:  '',  // nf-fa-circle-o
    rail:      '─',       // U+2500 box drawing
    running:   '',  // nf-fa-circle-play
    done:      '',  // nf-fa-check
    error:     '',  // nf-fa-times
    paused:    '',  // nf-fa-pause
};
```

## Verification method

Each codepoint above was looked up in the `8bitmcu/NerdFont-Cheat-Sheet/main/nerdfont.csv` file, scraped 2026-04-21. Raw examples verifying the codepoints:

```
nf-fa-bolt,f0e7,
nf-fa-clock,f017,
nf-md-clock,f0954,󰥔
nf-md-pencil,f03eb,󰏫
nf-md-refresh,f0450,󰑐
nf-md-lock,f033e,󰌾
nf-fa-dollar,f155,
nf-dev-git_branch,e725,
nf-md-robot,f06a9,󰚩
nf-fa-warning,f071,
nf-fa-circle,f111,
nf-fa-play_circle,f144,
nf-fa-check,f00c,
nf-fa-times,f00d,
nf-fa-pause,f04c,
nf-oct-git_branch,f418,
nf-oct-git_commit,f417,
nf-oct-git_merge,f419,
nf-fa-cloud_upload,f0ee,
nf-md-arrow_up_bold,f0737,󰜷
nf-md-arrow_down_bold,f072e,󰜮
nf-fa-inbox,f01c,
nf-dev-nodejs,e719,
nf-dev-python,e73c,
nf-dev-rust,e7a8,
nf-dev-go,e724,  (listed as nf-dev-go_language; alt nf-seti-go e65e)
nf-dev-react,e7ba,
nf-dev-javascript,e781,
nf-dev-typescript,e8ca,
nf-dev-docker,e7b0,
nf-dev-kubernetes,e81d,
nf-fa-terminal,f120,
nf-fa-cloud,f0c2,
```

All codepoints are stable since v3.0.x (2023). The Material Design icons in the `F0001+` range are the v3.0 migration target and are not expected to shift again.

## Alternatives not included

- **Powerline `nf-pl-*`** — skipped from the core map. Add a `BAR_STYLES.powerline` if/when powerline theming is adopted.
- **Pomicons `nf-pom-*`** — pomodoro-focused set; not relevant for a Claude statusline.
- **Weather `nf-weather-*`** — not a statusline fit (except possibly for a whimsical `nf-weather-lightning` `U+E315` as an alternative zap).
- **Emoji (SMP)** like `🤖 U+1F916`, `🌿 U+1F33F`, `🔒 U+1F512` — keep these as the `ICONS_UNICODE` fallback. They render in any UTF-8 terminal without a Nerd Font.
