# Rate-Limit Pace & Reset-Countdown UX — Master Summary

**Scope:** Research on pace/burn-rate formulas and reset-countdown UX for Claude Code statuslines, conducted to inform lean-statusline ideas #42 (pace delta), #43, #44 (reset-countdown collapse), #45 (projected-exhaustion ETA), #46, #47, #48.
**Last updated:** 2026-04-18
**Methodology:** Primary-source inspection of claude-pace source, ccusage docs, 8 alternative statuslines, 8 Reddit threads, 5 GitHub issues. Cross-checked against official `code.claude.com/docs/en/statusline` schema.

## Document Index

| File | Question answered |
|---|---|
| [formulas/01-claude-pace-exact-formula.md](formulas/01-claude-pace-exact-formula.md) | What is the exact pace formula in claude-pace's source? |
| [formulas/02-alternative-pace-formulations.md](formulas/02-alternative-pace-formulations.md) | What alternatives exist, and how do they handle the first-5-minute problem? |
| [schema/01-rate-limits-field-schema.md](schema/01-rate-limits-field-schema.md) | What is the authoritative schema for stdin `rate_limits`? |
| [schema/02-rate-limits-field-gotchas.md](schema/02-rate-limits-field-gotchas.md) | What reliability gotchas are documented for the field? |
| [tools/01-ccusage-statusline-subcommand.md](tools/01-ccusage-statusline-subcommand.md) | What does `ccusage statusline` render and cache? |
| [tools/02-statusline-landscape-feature-matrix.md](tools/02-statusline-landscape-feature-matrix.md) | Feature matrix across 10+ published statuslines |
| [ux/01-reset-countdown-and-collapse-ux.md](ux/01-reset-countdown-and-collapse-ux.md) | Reset-countdown format + collapse-on-narrow-terminal patterns |
| [community/01-burn-rate-displays-feedback.md](community/01-burn-rate-displays-feedback.md) | Do users find pace/ETA displays helpful or misleading? |

## Critical Findings

1. **claude-pace uses signed subtraction, not a ratio** — `delta = used_pct − elapsed_pct`. This is the single most important insight: it avoids the first-5-min explosion problem by design, because both operands are bounded in [0,100] and integer division in the 7d window naturally floors elapsed_pct at 0 for ~100 min. See [formulas/01](formulas/01-claude-pace-exact-formula.md). For lean-statusline idea #42: copy this formula verbatim; there is nothing more elegant to find.

2. **Three real pace formulations exist; each handles first-minutes differently.** claude-pace subtracts. vfmatzkin uses projection-ratio with a 2% window suppression floor. damiafuentes uses projection-ratio with a **minimum-1-day elapsed baseline for the 7d window**, which is the most honest weekly-projection formulation in the ecosystem. See [formulas/02](formulas/02-alternative-pace-formulations.md). For idea #45: the bursty-baseline floor is critical for any weekly ETA.

3. **`resets_at` is Unix epoch seconds in stdin, but ISO 8601 UTC via the OAuth endpoint.** Official docs confirm stdin is seconds. jtbr's gist confirms the OAuth endpoint returns ISO. A defensive parser accepting seconds / ms / ISO is trivial to write and future-proofs against any change. See [schema/01](schema/01-rate-limits-field-schema.md). You already handle all three; confirmed correct.

4. **The v2.1.100 "20K invisible tokens" regression validates stateless pace math.** Stateful formulas with hard-coded velocity thresholds broke overnight. claude-pace's pure subtraction and vfmatzkin's projection-ratio adapted automatically because they compare *current server-reported values* against elapsed time, no hard-coded baselines. See [schema/02](schema/02-rate-limits-field-gotchas.md). This is the strongest argument for not caching or rolling-averaging the pace signal.

5. **Users value reset countdown more than pace — the r/Anthropic 1mvi26m thread has 171 upvotes for "bring back the reset time".** Pace delta is a power-user enhancement; countdown is table stakes. See [ux/01](ux/01-reset-countdown-and-collapse-ux.md) and [community/01](community/01-burn-rate-displays-feedback.md).

6. **No inspected statusline implements an "imminent reset" state.** This is a clear open UX opportunity: when `reset < 5 min`, collapse both percent + countdown into a single highlighted `↻ 3m` pulse. For idea #46 (imminent-reset collapse): ship it.

7. **isaacaudet's 4-tier width ladder is the proven pattern for terminal-aware collapse.** ≥150 / 100-149 / 76-99 / <76 cols. 7d drops first, 5h percent is last to drop. aiedwardyi's priority-based drop with `CQB_MAX_WIDTH` env is a close second. For idea #44: adopt the tier ladder; it is easier to reason about than priority-based drop. See [ux/01](ux/01-reset-countdown-and-collapse-ux.md).

8. **ccusage `statusline` is a cost-oriented dashboard, not a rate-limit monitor.** It does not read `rate_limits.*.used_percentage` at all. It computes burn in $/hr from transcript JSONL. Heavy runtime (~90ms, ~57MB) and reported runaway-process issues at the 300ms poll rate. For lean-statusline: do not bundle ccusage logic; fork its cost display as a separate optional segment if needed. See [tools/01](tools/01-ccusage-statusline-subcommand.md).

9. **Bash+jq statuslines are ~10× faster than node-based ones.** claude-pace benchmarks at ~10ms / 2MB vs ccstatusline/ccusage at ~90ms / 57MB. At CC's ~300ms poll rate this is the difference between imperceptible and sluggish. For lean-statusline: keep the hot path bash-native; any node segments should be out-of-band / cached.

10. **Users consistently notice and complain when the statusline disagrees with native `/usage`.** ryoppippi/ccusage#916 documents exactly this. For lean-statusline: show the stdin-reported `used_percentage` raw; do not derive or "correct" it. Trust Anthropic's number.

## Cross-File Insights

- The **stateless-math pattern** (no history, no rolling averages) is the common thread across claude-pace's subtraction, vfmatzkin's projection, and damiafuentes's specification. All three are robust to silent server-side accounting changes (like the v2.1.100 regression). Any statusline that caches N historical samples to compute a smoothed burn rate is fragile in exactly the case where users need it most.

- The **stdin-only data path** (used by claude-pace, vfmatzkin, ccstatusline's Usage widgets) eliminates an entire class of multi-session bugs that plague OAuth-API-calling statuslines (daniel3303, isaacaudet, aiedwardyi, TahaSabir0 all ship caching workarounds). For lean-statusline: never add an OAuth call path; the stdin field is enough.

- The **countdown + percent + optional pace delta** trio is the minimum viable rate-limit UI. Everything else (ETA, projection, imminent-reset, gradient bars, terminal collapse) is additive. A lean statusline that ships exactly this trio is already competitive with the best in the ecosystem.

- The **asymmetry between 5h and 7d windows** is real and under-handled. The 5h window has uniform-ish usage patterns (people code for hours at a stretch); the 7d window is fundamentally bursty. Formulas that treat them the same (claude-pace's subtraction applies uniformly) work OK for 5h but are noisy for 7d. damiafuentes's "minimum 1-day elapsed baseline" for 7d is the only inspected recognition of this asymmetry.

## Action Items (Priority Ordered)

1. **Ship pace delta (#42) using claude-pace's subtraction formula.** 10 lines of code; stateless; floor-free by construction; scale-agnostic. High confidence. Put green ⇣ / red ⇡ next to the used % with magnitude only (no thresholds).

2. **Ship reset countdown as a first-class field (#43).** Unit-adaptive format: `NNs` / `NNm` / `Nh` / `Nd`. Drop seconds when >60s. Never show sub-1s. Non-negotiable per user sentiment.

3. **Ship imminent-reset collapse (#46 — new idea).** When `rm ≤ 5m`, replace "NN% ⇡N% Nm" with a single "↻ Nm" pulse in bright color. No existing statusline does this. Differentiating feature.

4. **Ship adaptive width collapse (#44) using isaacaudet's 4-tier ladder.** Drop 7d bar glyphs → 7d countdown → pace delta → 7d label → 5h countdown → 5h pace delta. Keep 5h percent always.

5. **Ship projected-exhaustion ETA (#45) cautiously.** Use damiafuentes's specification: `projected_pct = used × window / max(elapsed, 1_day_for_7d_window)`. Suppress when `used_pct < 2%`. Render as `~ Nh` (5h window) or `~ Wed` (7d). Prefix with tilde to signal projection. **Ship it behind a default-on flag; let users toggle off if they prefer honesty over aspiration.** See [community/01](community/01-burn-rate-displays-feedback.md) for the evidentiary basis.

6. **Do NOT ship a rolling burn-rate velocity indicator.** Stateful math is fragile to silent server-side changes. Every tool that worked through the Mar-Apr 2026 regression wave was stateless.

7. **Reorder the layout 5h-first, 7d-second.** Users hit the 5h limit 10× more often per week than the 7d limit (claude-code issues are almost entirely 5h-focused). The 5h window should be visually prioritized — larger bar, rightmost column, first-to-catch-the-eye position.

8. **Silent floor on `used_pct == 0` OR `rate_limits` absent.** Render `--` gracefully, never a zeroed bar that looks like "fresh window / plenty of room." The absence state must be visually distinct from the 0%-used state.

9. **Stale-cache marker.** When cached `rate_limits` is older than some threshold (isaacaudet uses 1 hour), annotate the display (`NN%~` with trailing tilde, or dim color). Not yet prevalent in the ecosystem; opportunity for differentiation.

10. **Verify `resets_at` parser handles seconds / ms / ISO.** User already confirms this is handled. Add a test fixture per format; assert current behavior never regresses.

## Coverage Scope

**This research covers:**
- Pace/burn-rate formula design and the first-5-min problem
- Reset-countdown format conventions
- Terminal-aware collapse patterns
- Multi-session / account-wide accounting semantics
- Field reliability and the Mar-Apr 2026 regression wave
- User feedback on whether displays help or mislead

**This research does NOT cover:**
- Cost/pricing display design (some treatment in ccusage section, but not exhaustive)
- Context-window compaction UX (tangential to rate-limits; separate concern)
- Model-specific burn rate differences (Opus vs Sonnet vs Haiku)
- Windows-specific display considerations (PowerShell rendering quirks)
- Subagent / worktree-specific display considerations
- Per-model weekly breakdown (`seven_day_opus`, `seven_day_sonnet` — documented but not UX-researched)
- The `extra_usage` overflow-credit field (Max subscription credit top-ups)

## Source Roll-Up

- **Official docs:** 1 (code.claude.com/docs/en/statusline)
- **Inspected source files:** 1 (claude-pace.sh v0.8.0, read verbatim)
- **Inspected READMEs:** 10 (claude-pace, ccusage, ccstatusline, CCometixLine, chongdashu, daniel3303, isaacaudet, aiedwardyi, TahaSabir0, vfmatzkin)
- **Gists:** 1 (jtbr OAuth-endpoint documentation)
- **GitHub issues:** 6 (anthropics/claude-code #41788 #41249 #41739 #36026, ryoppippi/ccusage #916, hesreallyhim awesome-claude-code #1158)
- **Reddit threads (high-signal):** 8 (r/ClaudeCode 1s520g6, 1sksf4p, 1rvy7ca, 1sc3d4w, 1sbggsf; r/SideProject 1shflq8; r/ClaudeAI 1mlweli; r/Anthropic 1mvi26m; r/Deno 1rm9flm)
- **Reddit threads (broader context):** ~60 indexed, not all quoted
