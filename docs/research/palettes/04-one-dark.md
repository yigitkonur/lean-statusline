# Atom One Dark — canonical palette

**URL:** https://github.com/atom/one-dark-syntax (archived 2018) · https://github.com/r3tex/one-dark (clean hex table) · https://github.com/joshdick/onedark.vim (vim port)
**License:** MIT — `Copyright (c) 2016 GitHub Inc.` (`raw.githubusercontent.com/atom/one-dark-syntax/master/LICENSE.md`, scraped 2026-04-21).
**Scraped:** 2026-04-21
**Variants:** Atom ships two themes: one-dark (the iconic dark) and one-light. This file covers one-dark; one-light is rarely ported separately.

## Canonical hex (from `r3tex/one-dark` README)

```
Black           #282c34      — background
White           #abb2bf      — foreground
Light Red       #e06c75      — red
Dark Red        #be5046
Green           #98c379      — green
Light Yellow    #e5c07b      — yellow
Dark Yellow     #d19a66      — orange
Blue            #61afef      — blue
Magenta         #c678dd      — magenta / purple
Cyan            #56b6c2      — cyan
Gutter Grey     #4b5263      — dim
Comment Grey    #5c6370      — subtle/muted
```

## 8-slot statusline mapping

| Slot | Hex |
|---|---|
| blue    | `#61AFEF` |
| orange  | `#D19A66` |
| green   | `#98C379` |
| cyan    | `#56B6C2` |
| red     | `#E06C75` |
| yellow  | `#E5C07B` |
| white   | `#ABB2BF` |
| magenta | `#C678DD` |

## Notes and cross-checks

- **joshdick/onedark.vim** is the most widely-ported vim version. Its palette matches the above for the "256 colors" mode and falls back to xterm-palette numbers for 16-color terminals.
- **Material Theme's "One dark"** entry has `#61aeef` / `#57b6c2` / `#c679dd` / `#e5c17c` — these differ from Atom's canonical by ±1 per channel. They're a transcription. Use Atom's values for "canonical One Dark".
- **One Dark Pro** (`Binaryify/OneDark-Pro` VS Code extension) is a derivative with slightly boosted saturation. Popular but diverges from Atom canonical — note it as a "cousin" palette if users ask for it.
- **Nvim OneDark themes** (`navarasu/onedark.nvim`, `olimorris/onedarkpro.nvim`) also diverge slightly from Atom. The tightest canonical version is the Atom source repo `atom/one-dark-syntax/styles/colors.less`.

## License text

```
MIT License

Copyright (c) 2016 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

The one-dark-syntax repo was archived on Sep 7, 2018 ("This repository was archived by the owner on Sep 7, 2018. It is now read-only."). The palette is stable since archival.
