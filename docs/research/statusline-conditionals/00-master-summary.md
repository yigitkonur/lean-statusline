# Master summary — statusline conditionals research for lean-statusline

**Goal:** Settle the #93 `conditionals` schema design by reading how ccstatusline, claude-powerline, cship, and claudeline model conditional visibility, decay, thresholds, and per-repo overrides — and by pinning down Claude Code's event model so decay-dependent ideas (#11, #12, #25, #78) can be rescored honestly.

**Written:** 2026-04-18

## Document index

| File | 1-line description |
|---|---|
| [event-model/01-claude-code-update-triggers-and-refreshinterval.md](event-model/01-claude-code-update-triggers-and-refreshinterval.md) | Claude Code fires the status-line script on new-assistant-message / permission-mode / vim-toggle, debounced 300ms, cancels in-flight runs. `refreshInterval` seconds is the only wall-clock primitive. |
| [event-model/02-stdin-schema-cheatsheet.md](event-model/02-stdin-schema-cheatsheet.md) | Inventory of all stdin fields, split into always-present / may-be-absent / may-be-null. `session_id` is the canonical cache key. |
| [ccstatusline/01-widget-config-and-hide-semantics.md](ccstatusline/01-widget-config-and-hide-semantics.md) | ccstatusline has no general DSL — each widget ships its own one-letter TUI toggles (`h` hide-when-empty on git family). Config is TUI-managed. No per-project override. |
| [claude-powerline/01-segment-schema-and-per-project-override.md](claude-powerline/01-segment-schema-and-per-project-override.md) | Flat `enabled` + `show*` booleans per segment, one-band `warningThreshold` in a `budget` block, three-tier config lookup (project → user → XDG, first-match-wins), hot reload. |
| [cship/01-starship-inherited-thresholds-and-format.md](cship/01-starship-inherited-thresholds-and-format.md) | Two-band `warn_threshold` + `critical_threshold` per module, per-project `cship.toml`, explicit `ttl` seconds, Starship passthrough via `$starship_prompt`. The cleanest threshold grammar in the survey. |
| [claudeline/01-only-shows-when-meaningful-and-cache-ttls.md](claudeline/01-only-shows-when-meaningful-and-cache-ttls.md) | No config file — CLI flags only. Hard-coded "hide when unavailable" for quota / update / status. Tiered cache TTLs (60s/15s, 24h/15s, 2min/30s) with distinct OK-vs-FAIL durations. |
| [recommendation/01-lean-statusline-conditionals-schema.md](recommendation/01-lean-statusline-conditionals-schema.md) | Prescriptive schema — six fields per segment: `requires`, `hide_when_equals`, `threshold {warn_at, critical_at, hide_below}`, `max_messages`, `cache {ttl_ok, ttl_fail}`, `detect_files`. No DSL, no wall-clock decay in v1. |

## Critical findings

1. **Wall-clock decay is genuinely unsolvable without `refreshInterval`.** Event triggers are new-message / permission-mode / vim-toggle only; they "can go quiet" (Anthropic's words) for minutes. Zero surveyed projects implement wall-clock decay — cship confirms "5s cache and updates happen whenever Claude responds". lean-statusline should replace `decay_seconds` with `max_messages` for the v1 API. See `event-model/01` and `recommendation/01`.
2. **The winning schema shape is `enabled + show* booleans + threshold block` per segment**, not a widget-level DSL. claude-powerline ships it, cship ships it with better thresholds, ccstatusline avoided it and paid with TUI-only config that doesn't round-trip through git. See `claude-powerline/01` and `ccstatusline/01`.
3. **Two bands (warn + critical) beats one band.** cship's `warn_threshold`/`critical_threshold` pair is the most repeated pattern across its 7 showcase configs; claude-powerline's single-`warningThreshold` limits users to one color transition. claudeline ships four hard-coded bands, proving users tolerate more if grounded in context-quality research. See `cship/01` and `claudeline/01`.
4. **Per-project override should be first-match-wins, not deep-merge.** Both claude-powerline and cship ship first-match; both are stable and committable. Deep merge would require documented key ownership semantics no one has written yet. See `claude-powerline/01` and `cship/01`.
5. **Cache TTLs must be per-source, not global, and OK-TTL should be longer than FAIL-TTL.** claudeline's 60s/15s, 24h/15s, 2min/30s tiering is the best prior art. Informs #78 (caching generally) as well as segments in #93 that hit networks. See `claudeline/01`.

## Cross-file insights

- **"Only show when meaningful" is an ethos, not a schema feature — yet.** claudeline encodes it by hard-coded predicates; claude-powerline encodes it per-segment with inline conditions in source; cship leaves it to users via format string inclusion. Nobody exposes it declaratively. lean-statusline's `requires` + `hide_when_equals` + `hide_below` would be the first declarative version.
- **TUI vs committable config is a sharp fork.** ccstatusline's TUI is beloved (Reddit: "amazing work making configuration accessible through that interactive interface") but collided badly with `claude update` for `u/torijinsir`. Committable project files (cship, claude-powerline) are boring but don't have this problem. Pick the boring side unless lean-statusline also ships a wizard that writes the JSON.
- **Stdin is the canonical state, not the transcript.** `session_id` is the universal cache key; `cost.total_duration_ms` is the universal monotonic clock; `transcript_path` is read lazily only when `max_messages` is in play. This constrains all conditionals to pure functions of stdin + (optionally) one filesystem read — easy to test, easy to cache, easy to commit.
- **Contradiction resolved:** r/ClaudeAI users asked cship's author whether refresh is event-driven or polling. Answer: event-driven with cache. This matches claudeline, which caches but does not poll. No surveyed project sets `refreshInterval` by default — which is correct, because it would burn CPU on idle sessions.

## Action items

| Priority | Action | File evidence |
|---|---|---|
| P0 | Adopt the 6-field `conditionals` schema in #93 verbatim from recommendation doc. Close the DSL sub-discussion; defer advanced expressions to v2 based on real user requests. | recommendation/01 |
| P0 | Rescore #11, #12, #25, #78: any that assume wall-clock decay should either (a) require users to opt into `refreshInterval`, or (b) pivot to `max_messages`. | event-model/01, recommendation/01 |
| P1 | For #94 / #95 / #96: use first-match project-file override (`./lean-statusline.config.json` beats `~/.claude/lean-statusline.json`), hot-reload on change. | claude-powerline/01 |
| P1 | Steal claudeline's tiered-TTL pattern for any segment that hits a network: `ttl_ok` long, `ttl_fail` short. | claudeline/01 |
| P2 | Borrow claudeline's `DisallowUnknownFields` schema-guard idea at test time so Anthropic stdin changes fail CI instead of in the field. | claudeline/01 |

## Coverage scope

**Covered:** Primary READMEs + reference configs + one Reddit thread per project for user feedback; official Claude Code statusline docs (full stdin schema + event model). All four target projects were scraped to source; cship's 7 showcase configs were all read verbatim.

**Not covered:**
- `src/types/Settings.ts` in ccstatusline (GitHub blob unauthenticated-scrape failed). The visible TUI keybind surface was used as a proxy; this is sufficient for schema design but not for a byte-level audit.
- Non-surveyed projects: `claude-hud`, `martinemde/starship-claude`, `vbelolapotkov/claude-statusline`, `spences10/claude-statusline-powerline`. Chosen scope was the user's named four plus Claude Code docs; further competitors weighed <1k stars and were unlikely to introduce a sixth paradigm.
- Dax Horthy "dumb zone" talk — referenced by claudeline as the basis for its 4-zone context ramp; not independently watched.

## Source roll-up

- **Official docs:** 1 page, scraped in full (`code.claude.com/docs/en/statusline`, 2026-04-18).
- **Project READMEs:** 4 (sirmalloc/ccstatusline, Owloops/claude-powerline, stephenleo/cship, fredrikaverpil/claudeline), all scraped 2026-04-18.
- **Auxiliary docs:** 1 (ccstatusline USAGE.md).
- **Reference config:** 1 JSON file (`Owloops/claude-powerline/.claude-powerline.json`).
- **Reddit threads:** 3 (1 per project for sirmalloc / owloops / stephenleo), fetched via `get-reddit-post`.
- **GitHub blob pages:** 1 attempted (ccstatusline Settings.ts), failed due to auth wall — documented as caveat.
