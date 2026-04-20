# What field-reliability gotchas have been documented in anthropics/claude-code rate_limits behavior?

**Scope:** Documented flakiness of the stdin `rate_limits` field: absence conditions, silent percentage regressions (20K invisible tokens, v2.1.100+), and staleness between sessions.
**Last updated:** 2026-04-18
**Confidence:** Medium-High — three primary sources (issue #41249, issue #41788, Reddit 1sj8o9l) + docs.

## Answer

The `rate_limits` field is reliable in **shape** (docs match what statuslines actually receive) but volatile in **semantics**. Known gotchas: (1) absent until first API response in a session; (2) can be absent for individual windows; (3) Claude Code v2.1.100+ silently injects ~20K tokens per request server-side, making `used_percentage` jump 40% faster than previous baselines; (4) during the Mar–Apr 2026 regression wave, multiple issues report the 5h window exhausting in under 70 minutes of light usage; (5) concurrent sessions see the same numbers (it's account-wide, not session-scoped), which can confuse users running 3+ tabs.

## Evidence

### Absence conditions (documented)

From `code.claude.com/docs/en/statusline`:
> `rate_limits`: appears only for Claude.ai subscribers (Pro/Max) after the first API response in the session. Each window (`five_hour`, `seven_day`) may be independently absent.

Corollaries statuslines must handle:
- Fresh session, first render: no `rate_limits` → show `--` or last-cached snapshot.
- API-key / enterprise users: never see `rate_limits` at all → the field must be optional everywhere in UI.
- Per-window absence can happen mid-session (confirmed by the `// empty` handling in the official example).

### The v2.1.100 silent-token regression (2026-Apr)

From [r/ClaudeCode/comments/1sn2tcf](https://reddit.com/r/ClaudeCode/comments/1sn2tcf) and [1sj8o9l](https://reddit.com/r/ClaudeAI/comments/1sj8o9l/why_claude_code_max_burns_limits_40_faster_with/):

> TL;DR: Claude Code v2.1.100+ silently adds ~20K invisible tokens to every request, server-side. This eats your limits faster AND may degrade [context quality].

This matters for pace math because:
- A user's internal model of "burn rate per request" shifted abruptly on an auto-update.
- Any pace formula based on *history* (rolling average of last-N snapshots) would correctly adapt. Any formula that hard-codes "normal burn = X%/hr" breaks.
- claude-pace's pure subtraction is unaffected — it only compares current state to elapsed time, no history.
- A projection-ratio formula is also unaffected: `projected = used × window / elapsed` scales with whatever the server is counting.
- **Inference:** stateless pace formulas are resilient to hidden-token regressions. Formulas with hard-coded velocity thresholds are not.

### The Mar–Apr 2026 regression wave

- [anthropics/claude-code#41788](https://github.com/anthropics/claude-code/issues/41788) — 2026-04-01 — Max 20 user exhausts 5h limit in ~70 minutes of "light conversational coding" on CC 2.1.89.
- [anthropics/claude-code#41249](https://github.com/anthropics/claude-code/issues/41249) — 2026-03-31 — CC 2.1.87 macOS: "Full exhaustion in less than an hour vs hours previously."
- [anthropics/claude-code#38357](https://github.com/anthropics/claude-code/issues/38357) — 2026-03-23 — "Max 20x usage climbing 5-10x faster."

These report that **`used_percentage` accelerates without an apparent cause visible to the client**. For a pace display, this means a previously-green ⇣5% can flip to red ⇡40% within a few prompts. The user's natural read is "the meter is wrong" — but the meter is accurate; the server-side accounting changed.

### The multi-session / account-wide behavior

From [r/Deno post 1rm9flm](https://reddit.com/r/Deno/comments/1rm9flm):
> If you run multiple Claude Code sessions (I run 5), the built-in OAuth API gets rate-limited and your statusline permanently shows -% (-).

And from [r/ClaudeCode/comments/1s4s6ye](https://reddit.com/r/ClaudeCode/comments/1s4s6ye):
> I use Cursor + the Claude code plug-in for my IDE, I have 5 tabs of sessions but usually only one or two is active at any one time.

Two distinct problems:
1. **OAuth-endpoint rate-limiting** affects statuslines that *call* `/api/oauth/usage` (claude-usage-monitor, TahaSabir0, isaacaudet). Stdin-based statuslines (claude-pace, vfmatzkin, lean-statusline) are immune.
2. **Account-wide accounting** means running 5 tabs → the 5h percentage on all 5 statuslines is identical and reflects the sum. Pace delta is therefore identical across tabs but the *per-tab* session cost differs. Users sometimes misread this as "only one tab counted."

### ccusage discrepancy (related-but-separate)

From [ryoppippi/ccusage#916](https://github.com/ryoppippi/ccusage/issues/916):
> I'm now using ccusage v18.0.10 with claude code v2.1.87, which has the `/usage` panel. I found out that the claude code usage stats is much higher than ccusage gives. Claude code usage shows that in the current session I used 22%, meanwhile ccusage shows I used only 6.9%.

This is not a `rate_limits` bug — it's that ccusage computes cost-based burn from transcript JSONL, which excludes server-injected tokens, cache-read weighting, etc. Users conflate the two displays. A lean statusline that shows *only* `rate_limits.*.used_percentage` is authoritative; one that also shows a ccusage-derived percent risks disagreement.

## Caveats / Negative Signal

- The v2.1.100 silent-token claim is backed by Reddit thread consensus and one detailed post, but no official Anthropic acknowledgement as of 2026-04-18. The magnitude (~20K) is user-measured, not confirmed by Anthropic.
- The GitHub issues in the Mar–Apr regression wave have not been formally resolved by Anthropic (as of snapshot). They are real user reports but do not necessarily indicate a stable bug — some may be correctly-accounted heavier-use patterns.
- Multi-session behavior is documented by users but not by Anthropic. Inferred account-wide semantics from the fact that all tabs show identical percentages.

## Sources

- [anthropics/claude-code#41788](https://github.com/anthropics/claude-code/issues/41788) — 2026-04-01 — Max 20 rapid exhaustion
- [anthropics/claude-code#41249](https://github.com/anthropics/claude-code/issues/41249) — 2026-03-31 — <1hr exhaustion report
- [anthropics/claude-code#41739](https://github.com/anthropics/claude-code/issues/41739) — feature request for reset-countdown in statusline — confirms the field is exposed but not shown by default
- [r/ClaudeCode/comments/1sn2tcf](https://reddit.com/r/ClaudeCode/comments/1sn2tcf) — v2.1.100 silent tokens
- [r/ClaudeAI/comments/1sj8o9l](https://reddit.com/r/ClaudeAI/comments/1sj8o9l/why_claude_code_max_burns_limits_40_faster_with/) — 20K hidden tokens analysis
- [r/Deno/comments/1rm9flm](https://reddit.com/r/Deno/comments/1rm9flm) — multi-session OAuth rate-limit issue
- [ryoppippi/ccusage#916](https://github.com/ryoppippi/ccusage/issues/916) — 2026-04~ — ccusage vs native /usage discrepancy
- [code.claude.com/docs/en/statusline](https://code.claude.com/docs/en/statusline) — 2026-04-18 — absence/nullability rules
