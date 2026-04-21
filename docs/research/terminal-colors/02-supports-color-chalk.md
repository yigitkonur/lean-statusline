# `chalk/supports-color` — the de-facto detection levels

**URL:** https://github.com/chalk/supports-color
**Scraped:** 2026-04-21
**Relevance:** `supports-color` is the most widely used Node.js color-capability detector, bundled transitively into tens of thousands of packages (chalk, ora, picocolors via indirect patterns, etc.). Its "level 0-1-2-3" vocabulary is how everybody talks about terminal color support.

## Verbatim excerpts

### Level semantics

> The `stdout`/`stderr` objects specify a level of support for color through a `.level` property and a corresponding flag:
>
> - `.level = 1` and `.hasBasic = true`: Basic color support (16 colors)
> - `.level = 2` and `.has256 = true`: 256 color support
> - `.level = 3` and `.has16m = true`: Truecolor support (16 million colors)

By implication, `.level = 0` is no color.

### `FORCE_COLOR` semantics

> `FORCE_COLOR=1` forces level 1, `FORCE_COLOR=2` forces level 2, `FORCE_COLOR=3` forces level 3, and `FORCE_COLOR=0` forcefully disables color. The use of `FORCE_COLOR` overrides all other color support checks.

### CLI flags

> It obeys the `--color` and `--no-color` CLI flags.
>
> Explicit 256/Truecolor mode can be enabled using the `--color=256` and `--color=16m` flags, respectively.

### `sniffFlags` option

> The options object supports a single boolean property `sniffFlags`. By default it is `true`, which instructs the detection to sniff `process.argv` for the multitude of `--color` flags. If `false`, then `process.argv` is not considered when determining color support.

## Implications for `lean-statusline`

1. **Use the same level vocabulary in docs and config.** If the rewrite adds a config field, name the values `truecolor | 256 | 16 | none` and map `none=0, 16=1, 256=2, truecolor=3` to match supports-color's convention. That's what users will recognize.
2. **`FORCE_COLOR=0` is the universal escape hatch.** Honor it in addition to `NO_COLOR`. `FORCE_COLOR=3` is a legitimate way to force truecolor output when env sniffing is unreliable (e.g. SSH).
3. **`--color=256` is a precedent we can copy.** A `--color=truecolor|256|none` CLI flag on `bin/lean-statusline` would be a small, cheap ergonomic win, but is out of scope for a palette rewrite. Note it for future.
4. **`NO_COLOR` semantics are not in this file** but are documented at [no-color.org](https://no-color.org/) — any non-empty value disables color. `lean-statusline`'s `lib/colors.mjs:140` already checks `process.env.NO_COLOR` — correct.

## Current `lean-statusline` alignment

`lib/colors.mjs:137-143` implements:

```js
export function colorsEnabled(envOverride, cfgValue) {
    if (envOverride === '1' || envOverride === 'true') return true;
    if (envOverride === '0' || envOverride === 'false') return false;
    if (process.env.NO_COLOR) return false;
    if (process.env.LEAN_STATUSLINE_NO_COLOR) return false;
    return cfgValue !== false;
}
```

This is consistent with `supports-color` for the **on/off** binary but does not implement levels. For a future upgrade, the function should return a level (0/1/2/3) and the palette renderer should branch accordingly. The present rewrite need not tackle this if "truecolor-only" remains the default.
