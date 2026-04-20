# What is the authoritative schema for `rate_limits` in the Claude Code statusline stdin payload?

**Scope:** Documents the canonical field structure from code.claude.com docs and cross-checks it against the one alternative data source (the `/api/oauth/usage` endpoint used by OAuth-based statuslines).
**Last updated:** 2026-04-18
**Confidence:** High — official docs + two independent statusline implementations agree.

## Answer

The stdin `rate_limits` object uses **Unix epoch seconds integers** for `resets_at` and **floating-point percentages 0–100** for `used_percentage`. The object is present **only on Claude.ai Pro/Max plans, only after the first API response in the session**. Each sub-window (`five_hour`, `seven_day`) may be independently absent. The separate OAuth endpoint (`/api/oauth/usage`) returns a different shape with **ISO 8601 UTC strings** for `resets_at` and `utilization` (not `used_percentage`).

## Evidence

### Canonical stdin shape (code.claude.com/docs/en/statusline)

```json
{
  "rate_limits": {
    "five_hour": {
      "used_percentage": 23.5,
      "resets_at": 1738425600
    },
    "seven_day": {
      "used_percentage": 41.2,
      "resets_at": 1738857600
    }
  }
}
```

Quoted field definitions from the docs:

> `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage` — Percentage of the 5-hour or 7-day rate limit consumed, from 0 to 100
>
> `rate_limits.five_hour.resets_at`, `rate_limits.seven_day.resets_at` — **Unix epoch seconds** when the 5-hour or 7-day rate limit window resets

Absence rule:

> `rate_limits`: appears only for Claude.ai subscribers (Pro/Max) **after the first API response in the session**. Each window (`five_hour`, `seven_day`) may be independently absent. Use `jq -r '.rate_limits.five_hour.used_percentage // empty'` to handle absence gracefully.

Source: [code.claude.com/docs/en/statusline](https://code.claude.com/docs/en/statusline) — fetched 2026-04-18.

### Parallel OAuth endpoint shape (jtbr gist)

```json
{
  "five_hour": {
    "utilization": 37.0,
    "resets_at": "2026-02-08T04:59:59.000000+00:00"
  },
  "seven_day": {
    "utilization": 26.0,
    "resets_at": "2026-02-12T14:59:59.771647+00:00"
  },
  "seven_day_opus": null,
  "seven_day_sonnet": { "utilization": 1.0, "resets_at": "2026-02-13T20:59:59.771655+00:00" },
  "extra_usage": { "is_enabled": false, "monthly_limit": null, "used_credits": null, "utilization": null }
}
```

- Endpoint: `GET https://api.anthropic.com/api/oauth/usage`
- Header: `anthropic-beta: oauth-2025-04-20`
- Field name is **`utilization`** (not `used_percentage`)
- `resets_at` is **ISO 8601 UTC string with microseconds** (not epoch seconds)
- Contains per-model breakdowns (`seven_day_opus`, `seven_day_sonnet`) not present in stdin
- Contains `extra_usage` for overflow credits

Source: [jtbr/4f99671d1cee06b44106456958caba8b](https://gist.github.com/jtbr/4f99671d1cee06b44106456958caba8b) — 2026-02~ — verified against the actual endpoint response shown in the gist.

### Minimal defensive parsing (for stdin path)

From the docs' own example:

```bash
FIVE_H=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
WEEK=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
```

claude-pace's parser handles the full set with type-coercion:

```bash
jq -r '[
  (.rate_limits.five_hour.used_percentage // null | if type=="number" then floor else "--" end),
  (.rate_limits.seven_day.used_percentage // null | if type=="number" then floor else "--" end),
  (.rate_limits.five_hour.resets_at // 0),
  (.rate_limits.seven_day.resets_at // 0)
]|@tsv'
```

Then validates with bash regex `[[ "$R5" =~ ^[0-9]+$ ]]` — so only integer epoch seconds are accepted.

### The two data paths summarized

| Aspect | stdin `rate_limits` | `/api/oauth/usage` |
|---|---|---|
| Triggered by | Claude Code itself, every statusline render | Explicit HTTPS call by script |
| Availability | CC 2.1.80+, Pro/Max, after first API response | Anywhere OAuth token works |
| Percentage field | `used_percentage` (0–100 number) | `utilization` (0–100 number) |
| Reset time | Unix epoch seconds integer | ISO 8601 UTC string |
| Per-model breakdown | No | Yes (`seven_day_opus`, `seven_day_sonnet`) |
| Extra credits | No | Yes (`extra_usage`) |
| Rate-limit risk on statusline | None (inline data) | API calls themselves can be rate-limited |
| Multi-session friendly | Yes (every session gets fresh data) | No — concurrent callers get rate-limited; see r/Deno post 1rm9flm |
| ToS concern | None (data already piped) | See vfmatzkin thread — Anthropic wording arguably bans OAuth tokens for non-CC/Claude.ai use |

## Caveats / Negative Signal

- The docs' reference JSON shows `used_percentage` as a **float** (`23.5`, `41.2`). Several statuslines coerce to integer with `floor` — this is safe but drops sub-1% precision.
- `resets_at` is documented as Unix epoch seconds, but during the Mar 2026 regression wave some users reported `/usage` showing inconsistent windows (see community threads). No primary source confirms the stdin field ever arrives as ms or ISO, but given the volatility of this surface, **defensive parsers that accept all three formats (sec, ms, ISO) reduce breakage risk at near-zero cost.**
- The doc's "after the first API response in the session" clause means a fresh session always renders `--` / no rate-limit section until the first round-trip completes. Users notice this — see `community/02-reset-countdown-ux-feedback.md`.
- Per-window absence: `five_hour` can be present while `seven_day` is absent, or vice versa. claude-pace's extractor treats them independently; lean-statusline must do the same.
- The OAuth endpoint path is TOS-ambiguous. [Anthropic's consumer ToS](https://code.claude.com/docs/en/legal-and-compliance) says OAuth tokens are "intended exclusively for Claude Code and Claude.ai." Several users raised this in r/ClaudeCode 1rvy7ca — no verdict as of 2026-04-18. Reading stdin is unambiguously safe.

## Sources

- [code.claude.com/docs/en/statusline](https://code.claude.com/docs/en/statusline) — Anthropic official docs — 2026-04-18 (today) — canonical schema
- [jtbr/4f99671d1cee06b44106456958caba8b](https://gist.github.com/jtbr/4f99671d1cee06b44106456958caba8b) — jtbr, credited codelynx.dev — 2026-02~ — OAuth endpoint shape
- `claude-pace.sh` v0.8.0 — Astro-Han — 2026-04-13 — defensive jq extractor
- [r/ClaudeCode/comments/1rvy7ca](https://reddit.com/r/ClaudeCode/comments/1rvy7ca) — u/Rabus raising OAuth-ToS concern — 2026-03~
