# What does ccusage's `statusline` subcommand render, and how does it fetch/cache data?

**Scope:** The `ccusage statusline` command's output format, data sources, caching strategy, and burn-rate formula, based on the official ccusage.com guide and the announcement thread.
**Last updated:** 2026-04-18
**Confidence:** High — primary source is the official ccusage.com docs + ryoppippi's announcement post.

## Answer

`ccusage statusline` renders a **single-line cost-oriented summary** focused on 5-hour "billing blocks" rather than Anthropic's 5h/7d rate-limit windows. It computes burn rate in **dollars per hour** (not percent per minute), using cost data from either Claude Code's `total_cost_usd` field (default `auto` mode) or its own LiteLLM-pricing calculator. Offline by default (cached pricing), runs per statusline render, no long-lived caching layer — it re-reads session state from stdin and from the Claude data dir every invocation. It does **not** read or use `rate_limits.*.used_percentage` at all.

## Evidence

### Output format

```
🤖 Opus | 💰 $0.23 session / $1.23 today / $0.45 block (2h 45m left) | 🔥 $0.12/hr | 🧠 25,000 (12%)
```

Component-by-component:
- `🤖 Opus` — active model from stdin `.model.display_name`
- `💰 $0.23 session` — cost for the current conversation
- `$1.23 today` — cumulative daily spend
- `$0.45 block (2h 45m left)` — cost within the active 5-hour billing "block" (a ccusage abstraction that groups Anthropic prompts into 5-hour buckets; distinct from the stdin `rate_limits.five_hour`)
- `🔥 $0.12/hr` — burn rate in dollars per hour (not tokens/min, despite the thresholds being token-expressed internally)
- `🧠 25,000 (12%)` — input tokens and context-window percentage

When no active block exists:
```
🤖 Opus | 💰 $0.00 session / $0.00 today / No active block
```

With `--cost-source both`:
```
🤖 Opus | 💰 ($0.25 cc / $0.23 ccusage) session / $1.23 today / $0.45 block (2h 45m left) | 🔥 $0.12/hr | 🧠 25,000 (12%)
```

### Burn-rate thresholds (cost-based, not rate-limit-based)

Direct from the docs:

> **Burn Rate** (`🔥 $0.12/hr`): Cost burn rate per hour with color-coded indicators:
> - Green text: Normal (< 2,000 tokens/min)
> - Yellow text: Moderate (2,000-5,000 tokens/min)
> - Red text: High (> 5,000 tokens/min)

The threshold boundaries are expressed in **tokens/min** while the displayed value is in **$/hr**. The mapping is implicit (model-dependent pricing).

`--visual-burn-rate` options: `off`, `emoji` (🟢/⚠️/🚨), `text` (Normal/Moderate/High), `emoji-text`.

### Cost-source modes

- `auto` (default) — prefer `.cost.total_cost_usd` from stdin; fall back to ccusage's LiteLLM-based calculation.
- `ccusage` — always use ccusage's own calculation.
- `cc` — always use Claude Code's pre-calculated cost.
- `both` — display both side-by-side. Official docs position this as "for debugging cost discrepancies."

### Caching strategy

- **Offline mode by default** — pricing data cached locally, no network call per render.
- `--no-offline` opts in to live LiteLLM pricing fetch.
- No explicit docs-level description of a data cache. The implementation re-reads from `~/.claude` session data directory every invocation. Under load (Claude Code polls every ~300ms per statusline), this was reported to cause **runaway node processes consuming all RAM** in the announcement thread ([r/ClaudeAI/comments/1mlweli](https://reddit.com/r/ClaudeAI/comments/1mlweli/), comments by u/thakala and u/Tommyruin).

Per the docs: "Reads session information from stdin (provided by Claude Code hooks) / Identifies the active 5-hour billing block / Calculates real-time burn rates and projections / Outputs a single line suitable for status bar display / Uses offline mode by default for instant response times without network dependencies."

### What ccusage statusline does NOT do

- Does NOT read `rate_limits.five_hour.used_percentage` or `rate_limits.seven_day.used_percentage` from stdin. It is cost-oriented, not quota-oriented.
- Does NOT show the weekly window.
- Does NOT display pace delta or a projected-exhaustion ETA.
- Does NOT show the reset timestamp of the Anthropic 5-hour or 7-day window — only the ccusage 5-hour "block" remaining time (which is a client-side bucketing, not the server window).

### Why this matters for lean-statusline's design

ccusage's statusline is a **pricing dashboard** pretending to be a rate-limit monitor. For a user on a Max subscription, knowing they burned $0.45 this block is less actionable than knowing they're at 62% of the 5-hour window with a ⇡15% pace delta — the cost has already been paid by the subscription, but the quota is what gates the next hour of work. ccusage is optimized for API-key / cost-tracking users; claude-pace / vfmatzkin are optimized for subscription / quota-tracking users.

## Caveats / Negative Signal

- ccusage's "block" concept is its own (rolling 5-hour windows grouped from transcript JSONL), not the same as `rate_limits.five_hour`. A user can be 90% through their rate-limit window but in a fresh cost-block, or vice versa.
- The runaway-node-process issue (announcement-thread comments) is not acknowledged in the official docs. Any lean-statusline intending to bundle ccusage logic should spawn a detached process or run the node-based logic out-of-band rather than on every ~300ms poll.
- `--cost-source both` exists *because* ccusage's internal calculation diverges from Claude Code's `total_cost_usd`. The docs frame this as a feature ("debugging cost discrepancies"); from the user's point of view, two disagreeing numbers on the statusline are noise.
- The burn-rate thresholds (2,000 / 5,000 tokens/min) are not configurable in the public CLI (docs mark "Configurable burn rate thresholds" as a planned beta feature).

## Sources

- [ccusage.com/guide/statusline](https://ccusage.com/guide/statusline) — official ccusage docs — 2026-04 — output format, thresholds, cost-source modes
- [github.com/ryoppippi/ccusage](https://github.com/ryoppippi/ccusage) — announcement README — general tool purpose
- [r/ClaudeAI/comments/1mlweli](https://reddit.com/r/ClaudeAI/comments/1mlweli) — ryoppippi's announcement — 545 upvotes, thread confirms feature scope — 2026-02~
- [ryoppippi/ccusage#916](https://github.com/ryoppippi/ccusage/issues/916) — 2026-04~ — ccusage vs /usage discrepancy demonstrates the cost-vs-quota divergence
