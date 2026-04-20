# How does claudeline achieve "only shows when meaningful", and what cache TTLs does it use?

**Scope:** fredrikaverpil/claudeline (Go, single binary, stdlib-only). Focus: opt-in flags, per-source cache TTLs, auto-hide rules, context color zones.
**Last updated:** 2026-04-18
**Confidence:** High — README documents the full architecture.

## Answer

claudeline has **no config file at all**. It is configured entirely via command-line flags on the `statusLine.command` entry. Visibility is controlled by three patterns:

1. **Opt-in flags for non-default segments** — `-cwd`, `-git-branch`, `-cost`. Default is "show only plan/model/context/quota", the minimum meaningful set.
2. **Hard-coded "hide when unavailable"** — quota bars silently disappear if the OAuth usage API fails; status icon hidden when all systems operational; update icon hidden when on latest version; compaction warning appears only within 5% of threshold.
3. **Tiered cache TTLs per data source** — 60s OK / 15s fail for usage API; 24h OK / 15s fail for update check; 2min OK / 30s fail for service status.

It also ships a **four-zone context color ramp** (0-40 green / 41-60 yellow / 61-80 orange / 80+ red) inspired by Dax Horthy's "dumb zone" theory on context-quality degradation — a concrete prior art for the #93 thresholds-in-config idea.

## Evidence

**Opt-in flag list (verbatim, README):**

| Flag | Default | Description |
|---|---|---|
| `-debug` | `false` | Write warnings/errors to `/tmp/claudeline/debug.log` |
| `-cwd` | `false` | Show working directory name |
| `-cwd-max-len` | `30` | Max display length for working directory name |
| `-git-branch` | `false` | Show git branch |
| `-git-branch-max-len` | `30` | Max display length for git branch |
| `-cost` | `false` | Show estimated session cost |

Config shape in `settings.json`:

```json
{ "statusLine": { "type": "command", "command": "claudeline -cwd -git-branch" } }
```

No JSON/YAML/TOML config. The flag set is the schema.

**Cache TTLs (verbatim, README Architecture):**

> "File-based cache: `/tmp/claudeline/usage.json` with 60s TTL on success, 15s TTL on failure."
> "Release tag is cached in `/tmp/claudeline/update.json` with 24h OK TTL, 15s fail TTL."
> "Cached in `/tmp/claudeline/status.json` with 2min OK TTL, 30s fail TTL."

Three observations worth stealing:

- **Different TTLs for different data sources** — don't use a single global cache duration. Session cost (stdin) has no cache; usage API has 60s; GitHub release check has 24h. Calibrate to data-volatility, not to convenience.
- **Distinct OK vs FAIL TTLs** — network failures get a short fail-TTL so recovery is fast; successful hits get a long OK-TTL to spare the API.
- **Cache keyed by file path, not `session_id`** — claudeline's caches are shared across sessions because the data (quota, version, status) is global per-user.

**Auto-hide rules (verbatim):**

- "The 5-hour and 7-day quota bars require a Claude Code subscription (Pro, Max, or Team). They are not available for Enterprise or API key users. The bars may also disappear silently if the usage API is temporarily unavailable or rate limited."
- "Shows a green `↑` indicator when a newer version is available. Hidden when already on the latest version or when the version cannot be determined (e.g. `(devel)`, `(unknown)`)."
- "Shows an orange fire icon with severity bars when there is a disruption... Hidden when all systems are operational."
- "A yellow `⚠️` appears on the context bar when usage is within 5% of the auto-compaction threshold (85% by default, configurable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`)."
- "A `🥵` appears on the context bar when `exceeds_200k_tokens` is true."

All five are hard-coded predicates. None are user-configurable. But they are **exactly the set of predicates a `conditionals` config would need to express** — and every one of them can be written as either `is_null(field)`, `field > threshold`, or `field == value`. No decay anywhere.

**Context zone theory (verbatim, README):**

> "Context bar: 5-char width using `█`/`░` with four color zones inspired by [Dax Horthy's 'dumb zone' theory]():
> - **Smart** (green, 0–40%) — model performs at full capability
> - **Dumb** (yellow, 41–60%) — quality starts to degrade
> - **Danger** (orange, 61–80%) — significant quality loss
> - **Near compaction** (red, 80%+) — approaching auto-compaction threshold"

Evidence that four bands (not three) is a defensible schema if grounded in research. cship picks two bands; claudeline picks four.

**Session cost visibility rule (verbatim):** "Always shown for direct API key users; opt-in with `-cost` for all others." — a dynamic default based on detected auth mode. Example of visibility logic that depends on a signal (credential type) *not* in the stdin JSON.

## Caveats / Negative Signal

- **No config file means no committable per-project setup.** To change defaults you edit the `command` string in `settings.json`. Works for solo users, hostile to teams.
- **No per-widget threshold config.** The 40/60/80 zones are hard-coded in Go. A lean-statusline `conditionals` map that exposes them to users is strictly more flexible.
- **The compaction warning uses an env var override (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`) instead of a config key.** Less declarative than competitors, but zero config-parse cost.
- **No mention of decay anywhere.** Confirms no project in the survey has solved time-limited segments.
- **Architecture strength:** schema-guarded testdata (`DisallowUnknownFields` in Go) catches Anthropic's stdin changes at CI time — pattern lean-statusline should adopt independently of the conditionals work.

## Sources

- [fredrikaverpil/claudeline README](https://github.com/fredrikaverpil/claudeline) — scraped 2026-04-18.
- Referenced: Dax Horthy, "dumb zone" YouTube talk — cited in the claudeline README as the basis for the four-zone context ramp; not independently verified for this research file.
