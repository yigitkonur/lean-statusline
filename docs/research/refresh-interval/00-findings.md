# Claude Code statusline: rate_limits refresh interval

**Scope:** How and when rate_limits data updates in the statusline stdin payload; refreshInterval mechanics and recommended value.
**Last updated:** 2026-04-21
**Confidence:** High — sourced from official Anthropic docs, changelog, GitHub issue tracker, and community project READMEs.

---

## 1. Is rate_limits updated on every API call, or on some other schedule?

**Every API call.** Claude Code already parses the `anthropic-ratelimit-unified-*` response headers from every API response it receives. The `rate_limits` object is derived from those headers and injected into the next statusline stdin payload — it does not have its own polling timer. The statusline is then re-invoked on each event trigger (see §2 below), so the data you read from stdin is always the value captured from the most-recent API response.

Source: `github.com/anthropics/claude-code/issues/27508` — "Claude Code already parses these headers from every API response (`DO6()` / `jC` state); they just aren't included in the `hp2()` statusLine JSON schema." The feature request asked to expose the already-parsed data; it was subsequently shipped.

Reddit corroboration: u/t_zk on r/ClaudeCode (2026, ~5 upvotes) — "On every message, Claude Code receives the remaining usage limits … No API calls, no external app running." u/Obvious_Equivalent_1 (+5) confirmed: "Rate_limits from stdin is the primary data source."

**Caveat:** `rate_limits` only appears for Claude.ai Pro/Max subscribers and is absent if no API call has been made yet in the session. Each window (`five_hour`, `seven_day`) may independently be absent.

---

## 2. Are there any documented update intervals for rate_limits in the statusline payload?

There is no separate timer for the `rate_limits` field itself. It updates when the statusline updates, which happens on these events:

- After each new assistant message completes
- When the permission mode changes
- When vim mode toggles

All three triggers are debounced at **300 ms**.

In the absence of new messages (idle sessions), `rate_limits` values are stale until the next event fires — unless you set `refreshInterval` (§4).

Source: `code.claude.com/docs/en/statusline` (official docs, scraped 2026-04-21) — "Your script runs after each new assistant message, when the permission mode changes, or when vim mode toggles." / "updates are debounced at 300ms."

---

## 3. Community project refreshInterval defaults

| Project | refreshInterval default | How rate_limits data arrives |
|---|---|---|
| **ccstatusline** (sirmalloc) | No explicit default; accepts CC's `refreshInterval` setting; docs say "Refreshes whenever the statusline is updated by Claude Code" | From stdin (no extra API calls for rate_limits itself) |
| **claudeline** (fredrikaverpil) | No `refreshInterval` in settings; uses its own file cache at **60 s TTL** for the usage API endpoint | Fetches undocumented `GET /api/oauth/usage` independently; caches 60 s OK / 15 s fail |
| **cship** (stephenleo) | No `refreshInterval` in CC settings; internal `ttl = 60` seconds for usage limits | 60 s cache TTL for usage limits; "increase if running many concurrent sessions" |
| **tzengyuxio/claude-statusline** | No CC `refreshInterval`; `CACHE_TTL` env var, **default 60 s** | API quota cached for 60 s; rationale: "background-cached API calls" for ~30 ms render |

Observations:
- Projects that call the Anthropic usage API directly converge on **60 s** as the cache interval. This is the practical floor for external API polling, not for the stdin payload.
- Projects that rely purely on stdin (ccstatusline, the vfmatzkin bash script) have no independent timer — they ride CC's event-driven invocations.
- The ccstatusline changelog shows "feat: add refreshInterval configuration for Claude Code status line" was added as a supported option, meaning users can set CC's own `refreshInterval` and ccstatusline will honor it.

Sources:
- `github.com/fredrikaverpil/claudeline` README (scraped 2026-04-21)
- `github.com/stephenleo/cship` README (scraped 2026-04-21)
- `github.com/tzengyuxio/claude-statusline` README (scraped 2026-04-21)
- `github.com/sirmalloc/ccstatusline/blob/main/docs/USAGE.md` (scraped 2026-04-21)

---

## 4. Documented minimum refreshInterval

**1 second (i.e., `refreshInterval: 1` in settings.json).**

From `code.claude.com/docs/en/statusline` (official docs): "The minimum is `1`."

The value is in **seconds** in the shipped setting. Note: the feature request issue (`github.com/anthropics/claude-code/issues/24463`) proposed **500 ms** as the minimum to "avoid perf issues", but the shipped implementation settled on **1 second**. The issue also showed the parameter in milliseconds (`"refreshInterval": 1000`) — that was pre-ship proposal syntax. The shipped setting uses seconds.

Changelog entry (`code.claude.com/docs/en/changelog`): "Added `refreshInterval` status line setting to re-run the status line command every N seconds."

Leave `refreshInterval` unset to run only on events (default behavior, no periodic timer).

---

## 5. Recommended refreshInterval for live rate-limit countdown timers

**Recommendation: `refreshInterval: 5` (5 seconds).**

Rationale:

1. **Rate_limits data source is event-driven, not second-by-second.** The `rate_limits` percentages only change when a new API call is made. Between messages there is nothing new to show from that field. A timer shorter than 5 s buys nothing for rate_limits accuracy.

2. **Countdown arithmetic is client-side.** The `resets_at` fields are Unix epoch timestamps. The actual countdown (e.g., "4h 27m remaining") is computed by your script as `resets_at - Date.now()/1000`. This arithmetic is correct at any polling frequency; you do not need to re-invoke the script every second to display an accurate countdown — you only need to re-invoke it often enough that the displayed number doesn't feel stale to the user.

3. **1 s is too aggressive for a script-based statusline.** A shell script (or node/python process) spawned every second adds measurable CPU overhead, especially for scripts that parse JSONL or make network calls. The minimum of 1 s exists for use cases like a live clock (`HH:MM:SS`), not for rate-limit bars.

4. **Community evidence.** Issue `#5685` (earliest refreshInterval request) suggested 30 s as a comfortable default for "not stale." Issue `#24463` used 1 s for the clock example but noted 500 ms as the perf floor. Issue `#37986` used 5 s as its concrete example value. External-API caching projects converge on 60 s as their floor. 5 s sits between "live clock" and "rarely polled" — appropriate for a countdown timer that users glance at rather than stare at.

5. **User experience.** A 5 s granularity on a countdown showing hours or minutes of remaining quota is imperceptible as lag. Sub-second updates on a multi-hour window add no information.

**Summary:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "/path/to/statusline.sh",
    "refreshInterval": 5
  }
}
```

If the statusline script is lightweight (pure jq on the stdin JSON, no external calls), **`refreshInterval: 1`** is fine and makes any elapsed-time or clock field feel live. If it shells out to `ccusage`, `git`, or a network endpoint, **`refreshInterval: 5` to `refreshInterval: 30`** is more appropriate.

---

## Sources

- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — Anthropic — 2026-04-21 — official spec: minimum, events, debounce, rate_limits schema
- [Changelog — Claude Code Docs](https://code.claude.com/docs/en/changelog) — Anthropic — 2026-04-21 — confirms refreshInterval and rate_limits field ship dates
- `anthropics/claude-code#24463` — community feature request — "refreshInterval: optional, no default; minimum 500ms proposed" — pre-ship
- `anthropics/claude-code#37986` — community feature request — example uses `refreshInterval: 5000` (ms, pre-ship proposal)
- `anthropics/claude-code#5685` — earliest refreshInterval request — example uses `refreshIntervalSeconds: 30`
- `anthropics/claude-code#27508` — rate_limits parsing path — "already parsed from every API response via anthropic-ratelimit-unified-* headers"
- [claudeline README](https://github.com/fredrikaverpil/claudeline) — fredrikaverpil — 2026-04-21 — 60 s OK / 15 s fail cache TTL for usage API
- [cship README](https://github.com/stephenleo/cship) — stephenleo — 2026-04-21 — `ttl = 60` for usage limits
- [tzengyuxio/claude-statusline README](https://github.com/tzengyuxio/claude-statusline) — 2026-04-21 — `CACHE_TTL` default 60 s
- [ccstatusline USAGE.md](https://github.com/sirmalloc/ccstatusline/blob/main/docs/USAGE.md) — sirmalloc — 2026-04-21 — "Refreshes whenever the statusline is updated by Claude Code"
- u/t_zk, r/ClaudeCode, 2026 — "On every message, Claude Code receives the remaining usage limits … No API calls"
- u/Obvious_Equivalent_1, r/ClaudeCode, 2026 (+5 upvotes) — "Rate_limits from stdin is the primary data source"
