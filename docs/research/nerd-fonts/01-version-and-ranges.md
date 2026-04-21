# Nerd Fonts v3.4.0 — release evidence and glyph ranges

**URL:** https://github.com/ryanoasis/nerd-fonts/releases · https://www.nerdfonts.com/releases · https://github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points
**License:** MIT (font patcher) + SIL OFL 1.1 (patched fonts) — `raw.githubusercontent.com/ryanoasis/nerd-fonts/master/LICENSE`, `Copyright (c) 2014 Ryan L McIntyre`.
**Scraped:** 2026-04-21

## Current version

**v3.4.0** — "Easter Release without Eggs" — released 2025-04-24.

Evidence verbatim from the releases page (scraped):

> "v3.4.0 Easter Release without Eggs"  
> "Mainly a font update release. No surprises here (we hope)."

From `nerdfonts.com/releases`:

> "v3.4.0 Release (2025.04.24)"

Previous release chain: v3.3.0 → v3.4.0 (April 2025). v3.2.1 (2024) introduced the FontAwesome codepoint migration table. v3.0.x (2023) introduced the Material Design migration from `F500+ nf-mdi-*` to `F0001+ nf-md-*`.

## What's new in v3.4.0

From release notes scrape:

- **Added**: Adwaita Mono, Atkinson Hyperlegible Mono
- **Updated**: 0xProto 2.300, Cascadia Code 2407.24, Geist Mono 1.401, InconsolataLGC 1.13, Iosevka 33.2.1, Lilex 2.600, Martian Mono 1.1.0, Monaspace 1.200, MPlus 1.007, Noto (Sans and Serif) 2.015, Ubuntu Sans 1.006
- **New icons**: "Add new CSS icon", "Manually optimize many Devicon icons"
- **Patcher**: `-s`/`--mono` replaces the removed `--use-single-width-glyphs` option
- **Output**: "The patched fonts in `otf` format are now much smaller (comparable to `ttf`)"
- **SymbolsOnly**: "Add fontconfig file to SymbolsOnly release archive (for repackagers)"
- **Nerd Font Propo**: "New variant in release Nerd Font Propo for GUI usecases"

## Breaking changes

> "Remove patcher option `--use-single-width-glyphs` (use `-s` or `--mono` instead)"

This only affects users running the patcher script themselves. Statusline users are unaffected.

## FontAwesome codepoint migration (historical, completed in v3.2.1)

From the v3.2.1 release notes, a table of 17 FontAwesome glyph relocations was shipped to accommodate FA v6. Relevant examples:

```
fa_less_than          EE00 → EFC3
fa_less_than_equal    EE01 → EFC4
fa_memory             EE02 → EFC5
fa_money_bill_wave    EE04 → EFC7
fa_not_equal          EE08 → EFCB
fa_palette            EE09 → EFCC
fa_avianex            F0E6 → EFC2
fa_diamond            F219 ⇄ F29F  (swapped with fa_gem)
fa_gem                F29F ⇄ F219
fa_cloudsmith         F16A ⇄ F167
fa_youtube            F167 ⇄ F16A
```

For `lean-statusline`'s curated icons this matters only if we include `nf-fa-gem` or `nf-fa-diamond`; the codepoints we reference in `00-findings.md` are **not** affected (all in the stable ranges).

## Glyph ranges (v3.3.0, stable through v3.4)

Canonical source: `github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points`.

```
Seti-UI + Custom       e5fa - e6b7
Devicons               e700 - e8ef
Font Awesome           ed00 - f2ff (with two gaps)
Material Design Icons  f0001 - f1af0
Weather                e300 - e3e3
Octicons               f400 - f533, also 2665 and 26A1
Powerline Symbols      e0a0 - e0a2, e0b0 - e0b3
Pomicons               e000 - e00a
Codicons               ea60 - ec1e
Font Logos             f300 - f381
IEC Power Symbols      23fb - 23fe, 2b58
```

## Font family count

Nerd Fonts does not publish an official total. Scraped archive list from v3.4.0 release assets:

```
0xProto, 3270, Adwaita, Agave, AnonymousPro, Arimo, Atkinson Hyperlegible, AurulentSansMono,
BigBlueTerminal, BitstreamVeraSansMono, CascadiaCode, CascadiaMono, CodeNewRoman, ComicShannsMono,
CommitMono, Cousine, D2Coding, DaddyTimeMono, DejaVuSansMono, DroidSansMono, EnvyCodeR, FantasqueSansMono,
FiraCode, FiraMono, GeistMono, Gohu, Go-Mono, Hack, Hasklig, HeavyData, Hermit, iA-Writer, IBMPlexMono,
Inconsolata, InconsolataGo, InconsolataLGC, IntelOneMono, Iosevka, IosevkaTerm, IosevkaTermSlab,
JetBrainsMono, Lekton, …
```

(archive listing truncated during scrape after Lekton; full list continues with Lilex, Martian, Meslo, Monaspace, Monoid, Mononoki, MPlus, Noto Sans, Noto Serif, RobotoMono, SauceCode, ShureTech, SpaceMono, Terminus, Tinos, Ubuntu, UbuntuMono, UbuntuSans, VictorMono — ~55-60 families total).

FreeBSD ports describe: "a collection of over 20 developer-targeted, patched fonts" — this is dated. `x11-fonts/nerd-fonts` package on FreeBSD, Gentoo's `symbols-nerd-font`, and Homebrew's `font-*-nerd-font` casks all track the upstream release tag directly.

## License text (excerpted)

```
The MIT License (MIT)

Copyright (c) 2014 Ryan L McIntyre

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

Separately, the patched font files themselves are under:

```
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

Copyright (c) 2014, Ryan L McIntyre (https://ryanlmcintyre.com).
```

The OFL is more restrictive than MIT for the font files (forbids selling the font on its own, requires preserving copyright in derivatives), but has no impact on programs that use the fonts via terminal rendering. `lean-statusline` does not redistribute the fonts — it emits codepoints that users render via their own installed Nerd Font.
