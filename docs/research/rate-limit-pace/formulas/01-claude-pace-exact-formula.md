# What is the exact pace formula used by Astro-Han/claude-pace?

**Scope:** Extracts the literal math from `claude-pace.sh` (v0.8.0, 2026-04-13) for both 5h and 7d windows, documents thresholds, first-minutes behavior, and the resets_at type the code assumes.
**Last updated:** 2026-04-18
**Confidence:** High — source file read verbatim; matched against README claims; one primary source.

## Answer

claude-pace computes `delta = used_pct − elapsed_pct` using integer subtraction (not division). The subtraction is only performed when `resets_at` is a future epoch-seconds integer AND `remaining_minutes ≤ window_total_minutes` (300 for 5h, 10080 for 7d). No explicit "first-5-min floor" exists — the subtraction naturally stays bounded because both operands are ≤100. Sign of delta flips arrow and color: positive → red `⇡N%`, negative → green `⇣N%`, zero → neither shown.

## Evidence

**The formula (from `claude-pace.sh`, `_usage()` function):**

```bash
# u = used percentage (integer from jq floor)
# w = window total minutes (300 for 5h, 10080 for 7d)
# rm = remaining minutes until reset
if [[ "$rm" =~ ^[0-9]+$ ]] && ((rm <= w)); then
    # Pace delta: positive = over pace (overspend), negative = under pace (surplus).
    local d=$((u - (w - rm) * 100 / w))
    ((d > 0)) && printf " ${R}⇡%d%%${N}" "$d"
    ((d < 0)) && printf " ${G}⇣%d%%${N}" "${d#-}"
fi
```

Simplified: `d = u − 100·(w−rm)/w`, i.e. `used_pct − elapsed_pct`. This is a **signed subtraction, not a ratio**, which is why the first-5-min explosion problem of `used/elapsed` never occurs. At t=0 with 1% used, `elapsed_pct ≈ 0`, so `d ≈ 1` — not infinity.

**Thresholds:** claude-pace does not classify "fast/slow/neutral". It only distinguishes **sign**:
- `d > 0` → red up-arrow with magnitude
- `d < 0` → green down-arrow with magnitude
- `d == 0` → nothing shown next to the percent

The README's `⇡15%` / `⇣15%` examples are **illustrative magnitudes**, not thresholds. There is no 15% gate.

**Color on the raw percentage (separate from the delta):** still from `_usage()`:
```bash
if ((u >= 90)); then printf "${R}%d%%${N}" "$u"
elif ((u >= 70)); then printf "${Y}%d%%${N}" "$u"
else printf "${G}%d%%${N}" "$u"
```
So the used-percent itself is bucketed green <70 / yellow 70–89 / red ≥90. The pace delta arrow is independent.

**Integer truncation, no floor needed:** both operands are integers. For the 7d window, `100/10080 ≈ 0.0099`, so integer division can make the elapsed_pct stay at 0 for the first ~100 minutes of a fresh 7d window. That is effectively a natural floor: `d = u − 0 = u` for the first ~1.7 hours of a weekly window. For the 5h window, `100/300 = 0.33`, meaning elapsed_pct ticks up by 1 every 3 minutes — so the earliest meaningful delta appears after 3 minutes.

**resets_at type assumption:** claude-pace reads `rate_limits.five_hour.resets_at` via jq with `//0`, then validates with `[[ "$R5" =~ ^[0-9]+$ ]]`. **Integer epoch seconds only.** ISO strings fail the regex; millisecond timestamps would parse as a huge number but still pass `> NOW` — potentially producing a wrong `rm` measured in minutes of epoch-ms (unlikely given the official docs say seconds).

**Window constants:**
- `_usage "$U5" "$RM5" 300` — 5h = 300 minutes
- `_usage "$U7" "$RM7" 10080` — 7d = 10080 minutes

## Caveats / Negative Signal

- The formula ignores variance — a 1-hour long session followed by a 4-hour idle period has the same delta as 5 hours of steady 20%/hr use, because claude-pace only sees the endpoint.
- Because the raw percentage is bucketed green/yellow/red on *used_pct* rather than delta, a user at 85% with ⇣5% (5% under pace) still sees a yellow percent — which can read as "urgent" when the actual trajectory is sustainable. This is a real UX inconsistency in claude-pace.
- No display cap on magnitude — `⇡97%` is possible and visually jarring. The code does not clamp.

## Sources

- [Astro-Han/claude-pace claude-pace.sh v0.8.0](https://raw.githubusercontent.com/Astro-Han/claude-pace/main/claude-pace.sh) — Astro-Han — 2026-04-13 — exact implementation read verbatim
- [Astro-Han/claude-pace README](https://github.com/Astro-Han/claude-pace) — 2026-04-13 — semantic description and threshold claims
