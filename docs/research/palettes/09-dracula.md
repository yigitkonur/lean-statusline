# Dracula (Classic, Alucard) — canonical palette

**URL:** https://draculatheme.com/spec · https://github.com/dracula/dracula-theme
**License:** MIT — `Copyright (c) 2023 Dracula Theme` (`raw.githubusercontent.com/dracula/dracula-theme/master/LICENSE`, scraped 2026-04-21).
**Scraped:** 2026-04-21
**Variants:** **Dracula Classic** (the iconic dark; `#282A36` bg) and **Alucard Classic** (light variant; `#FFFBEB` bg).

## Canonical hex (from `draculatheme.com/spec`)

### Dracula Classic (dark; `#282A36` bg, `#F8F8F2` fg)

| Slot | Hex |
|---|---|
| Background    | `#282A36` |
| Foreground    | `#F8F8F2` |
| Selection     | `#44475A` |
| Comment       | `#6272A4` |
| Red           | `#FF5555` |
| Orange        | `#FFB86C` |
| Yellow        | `#F1FA8C` |
| Green         | `#50FA7B` |
| Cyan          | `#8BE9FD` |
| Purple (blue) | `#BD93F9` |
| Pink (magenta)| `#FF79C6` |

Note: Dracula calls its blue-hued accent "Purple" (`#BD93F9`). In a statusline's 8-slot schema, this is the **blue** role. Dracula's "Pink" (`#FF79C6`) is the magenta role.

### Terminal ANSI mapping (Dracula Classic)

```
AnsiBlack          #21222C      AnsiBrightBlack    #6272A4
AnsiRed            #FF5555      AnsiBrightRed      #FF6E6E
AnsiGreen          #50FA7B      AnsiBrightGreen    #69FF94
AnsiYellow         #F1FA8C      AnsiBrightYellow   #FFFFA5
AnsiBlue           #BD93F9      AnsiBrightBlue     #D6ACFF
AnsiMagenta        #FF79C6      AnsiBrightMagenta  #FF92DF
AnsiCyan           #8BE9FD      AnsiBrightCyan     #A4FFFF
AnsiWhite          #F8F8F2      AnsiBrightWhite    #FFFFFF
```

### Alucard Classic (light; `#FFFBEB` bg, `#1F1F1F` fg)

| Slot | Hex |
|---|---|
| Background    | `#FFFBEB` |
| Foreground    | `#1F1F1F` |
| Blue (purple) | `#644AC9` |
| Orange        | `#A34D14` |
| Green         | `#14710A` |
| Cyan          | `#036A96` |
| Red           | `#CB3A2A` |
| Yellow        | `#846E15` |
| White         | `#1F1F1F` |
| Magenta (pink)| `#A3144D` |

### Terminal ANSI mapping (Alucard Classic)

```
AnsiBlack          #FFFBEB      AnsiBrightBlack    #6C664B
AnsiRed            #CB3A2A      AnsiBrightRed      #D74C3D
AnsiGreen          #14710A      AnsiBrightGreen    #198D0C
AnsiYellow         #846E15      AnsiBrightYellow   #9E841A
AnsiBlue           #644AC9      AnsiBrightBlue     #7862D0
AnsiMagenta        #A3144D      AnsiBrightMagenta  #BF185A
AnsiCyan           #036A96      AnsiBrightCyan     #047FB4
AnsiWhite          #1F1F1F      AnsiBrightWhite    #2C2B31
```

## 8-slot statusline mapping

### dracula (dark)

| Slot | Hex |
|---|---|
| blue    | `#BD93F9` |
| orange  | `#FFB86C` |
| green   | `#50FA7B` |
| cyan    | `#8BE9FD` |
| red     | `#FF5555` |
| yellow  | `#F1FA8C` |
| white   | `#F8F8F2` |
| magenta | `#FF79C6` |

### alucard (light)

| Slot | Hex |
|---|---|
| blue    | `#644AC9` |
| orange  | `#A34D14` |
| green   | `#14710A` |
| cyan    | `#036A96` |
| red     | `#CB3A2A` |
| yellow  | `#846E15` |
| white   | `#1F1F1F` |
| magenta | `#A3144D` |

## Drift flag — our current `dracula` is broken

`lib/colors.mjs`:

```js
'dracula': {
    blue:    [139, 233, 253],  // #8be9fd  ← THIS IS CYAN, NOT BLUE
    orange:  [255, 184, 108],  // #ffb86c  ← correct
    green:   [80, 250, 123],   // #50fa7b  ← correct
    cyan:    [139, 233, 253],  // #8be9fd  ← duplicate of "blue"
    red:     [255, 85, 85],    // #ff5555  ← correct
    yellow:  [241, 250, 140],  // #f1fa8c  ← correct
    white:   [248, 248, 242],  // #f8f8f2  ← correct
    magenta: [189, 147, 249],  // #bd93f9  ← THIS IS DRACULA'S "PURPLE" / the canonical BLUE SLOT
},
```

**Two bugs:**
1. `blue` is set to `#8be9fd` which is canonical **cyan**.
2. `magenta` is set to `#bd93f9` which is canonical **blue (purple)**.

The `cyan` slot then duplicates `blue` (both `#8be9fd`), leaving us with only 7 distinct hues instead of 8.

**Fix:**
```js
blue:    [189, 147, 249],  // #bd93f9  ← Dracula's "purple" = blue role
cyan:    [139, 233, 253],  // #8be9fd  ← cyan (unchanged)
magenta: [255, 121, 198],  // #ff79c6  ← Dracula's "pink" = magenta role
```

This makes all 8 slots distinct and aligns with the Dracula spec.

## License text

```
The MIT License (MIT)

Copyright (c) 2023 Dracula Theme

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```
