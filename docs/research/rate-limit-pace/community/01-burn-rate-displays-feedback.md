# Do practitioners find burn-rate statusline displays helpful or misleading?

**Scope:** Reddit and GitHub feedback specifically on burn-rate / pace / projected-exhaustion displays. Focus on whether users trust the number and whether it changes behavior.
**Last updated:** 2026-04-18
**Confidence:** Medium-High — 5 independent threads with quoted feedback, plus the Mar-Apr 2026 regression-wave context.

## Answer

Practitioners overwhelmingly want a burn-rate display: three separate authors built their own after being burned mid-refactor. But the displays users *keep* running are the **simple, stateless** ones (percent + countdown + pace delta). The ones users complain about are (a) displays that disagree with the native `/usage`, and (b) displays that flap between "fine" and "urgent" as the window fills. There is no documented instance of a user finding projected-exhaustion ETAs reliable-enough-to-plan-by. The honest signal is the pair "% used" + "time to reset"; the aspirational signal (ETA) is valued during calm periods and dismissed during regression waves.

## Answer detail: projected-exhaustion ETA verdict

**Ship it as a secondary, suppressible segment, not a primary claim.** Evidence below supports three positions:

1. Users actively request the ETA when it's absent (damiafuentes thread, ccusage announcement comments).
2. Users dismiss the ETA as noise during regression waves when server-side accounting shifts (Mar-Apr 2026 wave, claude-code#41249, #41788).
3. No Reddit thread inspected shows a user saying "the ETA was wrong and I made a bad decision because of it."

The balance supports shipping with (a) clear suppression before 2% of window elapsed, (b) conservative thresholds (projected >100% triggers, not 110%), (c) a visible indicator that the ETA is a projection not a guarantee (the `~` prefix in "out ~Wed" does this job well), and (d) an env-var or config flag to disable the ETA for users who don't want it.

## Evidence

### The pain that motivates the feature

[r/SideProject/comments/1shflq8](https://reddit.com/r/SideProject/comments/1shflq8) — u/Dramatic_Solid3952:
> Claude Code has /usage built in but you have to actually remember to type it — I kept forgetting until I was already at 90%+ and panicking mid-refactor.

Reply from u/Nice-Pair-2802 (+2):
> Yeah, same here - typing /status like a paranoiac every time a task is mid-process and the token limit is low. ... couldn't focus on anything when half my brain was just wondering when I was gonna get cut off.

[r/ClaudeCode/comments/1s520g6](https://reddit.com/r/ClaudeCode/comments/1s520g6) — u/t_zk framing:
> On every message, Claude Code receives the remaining usage limits, but they aren't shown (until you're very close to 100%). I made a script to capture that data before it gets discarded and display it all the time.

**Takeaway:** the demand is latent but strong — users independently build the same thing. The acute pain is "I didn't know until it was too late to finish the current refactor." A pace display that warns 20 minutes ahead converts this from panic to routine.

### What users approve of

[r/ClaudeCode/comments/1sksf4p](https://reddit.com/r/ClaudeCode/comments/1sksf4p) — u/damiafuentes, 2026-04:
> The part I find most useful is the burn-rate projection — it extrapolates your current usage pace and warns you when you're on track to hit the limit (e.g., "out ~Wed" for the weekly window or "out ~2h" for the 5-hour window).

**This is the only primary-source endorsement of projected-exhaustion ETAs** as "most useful." The poster built and uses the spec daily.

[r/ClaudeCode/comments/1rvy7ca](https://reddit.com/r/ClaudeCode/comments/1rvy7ca) — u/kalos-kagatos:
> I kept running into the same two problems while vibe-coding with Claude Code: not knowing how deep into my context window I was until performance started degrading, and having no idea how much of my 5-hour session I'd burned through until I hit the wall.

Reply u/kyletraz (+1):
> Context rot is so real, and the worst part is you don't notice it creeping in until Claude starts confidently generating nonsense. Having that visibility right in the status line is a great call.

Kalos-kagatos on behavior change from having the number visible:
> definitely more aggressive with compacting now. Before I'd hold off because I wasn't sure if it was actually context rot or just a bad prompt. Now when I see it climbing past 60-65% and the output starts feeling off, I don't second guess it.

**Takeaway:** the display changes behavior in a good way (earlier compacting / earlier break). This generalizes to "pace indicator makes the decision to pause conscious instead of reactive."

### What users complain about

[ryoppippi/ccusage#916](https://github.com/ryoppippi/ccusage/issues/916) — 2026-04~:
> Claude code usage shows that in the current session I used 22%, meanwhile ccusage shows I used only 6.9%. Is there any config that I missed?

**Takeaway:** any display that **disagrees with the native `/usage`** is net-negative — it becomes a source of confusion rather than resolution. A lean statusline should surface the exact same percent Anthropic sends, not compute its own.

[r/ClaudeAI/comments/1mlweli](https://reddit.com/r/ClaudeAI/comments/1mlweli) — ccusage announcement, u/thakala (+9):
> I installed this and now I am seeing runaway node processes running ccusage which eventually consume all RAM. Is it just me?

u/Tommyruin (+6): "Not just use, found this issue today also."

**Takeaway:** heavy statuslines destabilize the terminal at CC's ~300ms poll rate. A pace display that costs a full node startup every render is a regression even if the math is right.

### The regression-wave problem

During 2026-03-23 to 2026-04-01, multiple issues report `used_percentage` accelerating 5–10× faster than prior baselines with no apparent cause:

- [anthropics/claude-code#38357](https://github.com/anthropics/claude-code/issues/38357) — "Max 20x usage climbing 5-10x faster" — 2026-03-23
- [anthropics/claude-code#41249](https://github.com/anthropics/claude-code/issues/41249) — 2026-03-31 — "Full exhaustion in less than an hour vs hours previously"
- [anthropics/claude-code#41788](https://github.com/anthropics/claude-code/issues/41788) — 2026-04-01 — Max 20, 70 minutes of light use to 100%

And ongoing Reddit threads:

[r/ClaudeCode/comments/1sc3d4w](https://reddit.com/r/ClaudeCode/comments/1sc3d4w) — "Hit the 5h rate limit twice in one day, burned 33% of my weekly quota in 12 hours":
> I've been actively rationing my usage - spacing out sessions, being selective about what I send to Claude, trying to stay well within the [limits].

[r/ClaudeCode/comments/1sbggsf](https://reddit.com/r/ClaudeCode/comments/1sbggsf):
> Claude Code users hitting usage limits 'way faster than expected ... Claude users can burn their five-hour session limits in under five hours.

**Takeaway:** During a regression wave, *any* projected-exhaustion ETA derived from current burn rate correctly says "out in 30 minutes" because the burn IS that fast. The ETA isn't misleading — it's accurately reporting a shocking reality. But users who remember pre-wave normal behavior will perceive the ETA as alarmist. A prudent design:
- Suppress ETA when `used_pct < 2%` of window (noise floor).
- Show ETA with a `~` prefix to signal projection, not guarantee.
- Never flash/blink the ETA — reserve urgency cues for the raw percent color.

### The "just show me the reset time" baseline

[r/Anthropic/comments/1mvi26m](https://reddit.com/r/Anthropic/comments/1mvi26m) — 171 upvotes, 104 comments — the single most-engaged rate-limit-UX thread in this research:

> Claude code used to show the time that it'd reset. It was quite helpful to be able to plan for getting lunch, coffee, workout, etc.

A substantial population is completely satisfied by "% used + reset time" without any pace math whatsoever. The pace delta adds real value for power users; for casual users the countdown alone is enough.

**Takeaway:** the countdown is non-negotiable. The pace delta is high-value. The projected ETA is nice-to-have and regression-wave-fragile.

## Caveats / Negative Signal

- No single inspected thread has a user saying "the projected ETA caused me to make a wrong call." The argument against ETAs is inferential, not testimonial.
- Sample skews toward power users publishing tools, not casual users. Casual-user feedback ("my bar is wrong and I don't know why") is under-represented.
- The regression-wave context may normalize over time. If server-side accounting stabilizes, the ETA becomes more trustworthy. The recommendation should revisit every ~3 months.
- "Users build what they want" evidence is strong for the pace indicator; weaker for the ETA specifically — most of the built-tools show pace without ETA.

## Sources

- [r/ClaudeCode/comments/1sksf4p](https://reddit.com/r/ClaudeCode/comments/1sksf4p) — u/damiafuentes — 2026-04 — ETA endorsement
- [r/ClaudeCode/comments/1rvy7ca](https://reddit.com/r/ClaudeCode/comments/1rvy7ca) — u/kalos-kagatos — 2026-03~ — behavior change from visible pace
- [r/SideProject/comments/1shflq8](https://reddit.com/r/SideProject/comments/1shflq8) — u/Dramatic_Solid3952 — 2026-03~ — pain that motivated tool build
- [r/ClaudeCode/comments/1s520g6](https://reddit.com/r/ClaudeCode/comments/1s520g6) — u/t_zk — 2026-02~ — framing for always-visible limits
- [r/Anthropic/comments/1mvi26m](https://reddit.com/r/Anthropic/comments/1mvi26m) — u/Sofullofsplendor_ — 2025-08~ — 171 upvotes countdown grief
- [r/ClaudeAI/comments/1mlweli](https://reddit.com/r/ClaudeAI/comments/1mlweli) — ryoppippi, thakala — 2026-02~ — runaway process feedback
- [ryoppippi/ccusage#916](https://github.com/ryoppippi/ccusage/issues/916) — 2026-04~ — disagreement with /usage
- [anthropics/claude-code#41249](https://github.com/anthropics/claude-code/issues/41249), [#41788](https://github.com/anthropics/claude-code/issues/41788), [#38357](https://github.com/anthropics/claude-code/issues/38357) — Mar-Apr 2026 regression wave
- [r/ClaudeCode/comments/1sc3d4w](https://reddit.com/r/ClaudeCode/comments/1sc3d4w), [/1sbggsf](https://reddit.com/r/ClaudeCode/comments/1sbggsf) — 2026-04 — practitioner reports of burn speed
