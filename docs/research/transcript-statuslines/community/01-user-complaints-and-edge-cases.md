# What do practitioners actually complain about with transcript-based statuslines?

**Scope:** Real complaints from GitHub issues, Reddit, and HN about transcript-parsing statuslines in practice — performance, staleness, breakage on format changes.
**Last updated:** 2026-04-18
**Confidence:** Medium-high — 6 concrete citations, but volume is modest (this is a small niche; most users don't notice). No systematic thread scrape beyond what's listed.

## Answer

The dominant complaint is **CPU** (ccusage at 300%+), not staleness or correctness. Next is **breakage on schema drift** (intermediate usage snapshots undercounting, multi-instance model confusion). Staleness is less complained about than expected — users tolerate 1–3 second lag on a statusline. The loudest user-visible *failure mode* is the whole-session file growing to multi-GB and hanging Claude Code itself, which no statusline caused but which every full-read statusline would stumble over.

## Evidence

### [Complaint 1] CPU: ccusage at 300%+

`ryoppippi/ccusage#804` ("statusline command causes high CPU usage (300%+) on startup"), 2025-09:

> "Each ccusage process consumes 100-400% CPU on startup. Memory usage spikes to 1.5-2.4GB per process. With 2 sessions: combined CPU usage reaches 600%+. v17.2.1 eventually stabilizes (after ~30 seconds) to ~70% CPU. v18.0.5 never stabilizes, stays at 300%+ indefinitely."

Reporter workaround: disable statusline entirely with `"command": "echo ''"`.

ccusage scans **all** JSONL files in the Claude state dir, not just the current session, which is why it's this bad. But it's what a Node-based transcript parser looks like when someone got ambitious without caching.

### [Complaint 2] Undercounted tokens from dedupe-first-wins

`ryoppippi/ccusage#888` ("Claude usage can be undercounted when the same request is written multiple times"), 2026-03-11:

> "`ccusage` matched the `first seen` result, which is the smallest one. [...] `outputTokens = 130,785` first seen vs `648,562` latest seen — ccusage matched the smallest. [...] `first seen wins` for messages with same `message.id + requestId` systematically undercounts by ~80% on days with heavy duplicate writes."

Root cause: the transcript writes intermediate usage snapshots before the final. A naive dedupe keeps the first. Any statusline doing cache-efficiency ratio or per-turn tokens has to use latest-seen.

### [Complaint 3] Multi-instance model confusion

`Haleclipse/CCometixLine#96` ("Model updates incorrectly with multiple Claude Code instances"), 2025:

> "If you open two Claude Code instances with different models, after a short while, ccline will update to display the same model across both—even though the actual model used in each session differs."

Root cause (inferred): `~/.claude/ccline/*.json` caches get written by whichever process runs last; there's no per-session-id partitioning. Any cross-session caching strategy has this trap.

### [Complaint 4] Stale data / frozen counters

`kamranahmedse/claude-statusline#27` ("Current usage sometimes gets stuck and stops updating"):

> "the current row will sometimes freeze and show stale data for a long time."

Typical of a stat-based cache that misses a write due to mtime granularity or a failed invalidation.

### [Complaint 5] SIGINT artifacts

`Haleclipse/CCometixLine#107` ("Status line leaves artifacts in terminal after Ctrl+C exit"), 2026:

> "When exiting Claude Code with Ctrl+C, the ccline status line's box-drawing characters (`─`) are left behind in the terminal output. [...] It appears that when Claude Code's process receives SIGINT, ccline doesn't get a chance to clear its rendered status line from the terminal."

Not a parser complaint, but a reminder that the statusline process can be killed mid-output. Any write of a persistent cache must happen before `stdout.end()`.

### [Complaint 6] Session JSONL unbounded growth

`anthropics/claude-code#22365` ("Large session JSONL files cause Claude Code to hang and OOM"), 2026-02-01:

> "A single session JSONL file in `~/.claude/projects/...` had grown to 3.8 GB. Three other session files were 13-28 MB. Claude Code appears to load or index these files on every prompt, causing the memory explosion and hang. [...] top showed the Claude process consuming 12.8 GB of RAM."

Workaround: `find ~/.claude/projects/ -name "*.jsonl" -size +50M -delete`. This is Claude Code's own bug, but any statusline full-reading the transcript becomes the visible symptom first.

### [Complaint 7] API-key users get blank rate limits

From the pyCCsl, cc-statusline, and ccstatusline project notes (multiple posts in r/ClaudeAI "Show me your statusline" megathread, 2025-12): rate_limits fields are null for direct API users. Any statusline hardcoding "5h usage bar" silently breaks for them.

### [Complaint 8] Frame rate degradation over time

`u/anonymous`, r/ClaudeAI 2025-11 ([post](https://www.reddit.com/r/ClaudeAI/comments/1qme7s9/)):

> "Has anyone else had issues with frame rate? I haven't seen issues with slow response times, but the frame rate has been getting so bad that I [..]"

Observational, not a direct parser complaint. Matches the Medium article "When Your Claude Code Becomes Terribly Slow Over Time" (@j.y.weng, 2025) which pins the blame on `~/.claude.json` metadata bloat — i.e. the same general class of "Claude Code accumulates state" problem.

### [Countervailing signal] Most users don't care

From r/ClaudeCode "Show me your /statusline" megathread (+~100 comments) and Medium articles surveyed: the vast majority of users run simple `jq`-based stdin-only statuslines with no transcript parsing. The population complaining about transcript perf is a small self-selected slice. Most users either:
1. Use claude-hud and accept the opt-in surface
2. Use ccstatusline and trust it
3. Write a 5-line jq script and never touch the transcript

For a "zero-dep Node statusline" project, the target audience is group 3 — so transcript parsing is a differentiator, not a baseline expectation.

## Caveats / Negative Signal

- The ccusage #804 CPU issue is about ccusage specifically scanning all sessions, not the transcript-parsing model in the abstract. A single-session statusline doing the same work would be ~10x cheaper.
- ccusage is so popular that its pathologies are the loudest; this skews the feedback toward "ccusage is slow" rather than "transcript parsing is slow."
- I did not find a high-signal complaint about claude-hud specifically being slow. Either its cache + opt-in lines work, or users who tried it didn't blog.

## Sources

- `ryoppippi/ccusage#804` — 300% CPU, 2.4GB RAM — 2025-09
- `ryoppippi/ccusage#888` — first-seen dedupe undercount — 2026-03-11
- `Haleclipse/CCometixLine#96` — multi-instance model bleed-through — 2025
- `Haleclipse/CCometixLine#107` — SIGINT terminal artifacts — 2026
- `kamranahmedse/claude-statusline#27` — frozen usage row — 2025
- `anthropics/claude-code#22365` — 3.8 GB session file OOM — 2026-02-01
- `u/rz1989s` r/ClaudeAI +51 upvotes 2026-01 — transcript files "were there the whole time"
- `u/OtherwiseJellyfish73` r/ClaudeAI 2026-01 — "62ms" claude-hud perception (unverified)
- `u/dwtexe` r/ClaudeAI 2025-08 — CCometixLine faster/lighter than ccusage
- `u/AmazingYam4` r/ClaudeAI 2025-08 — hardcoded 200K context limit brittleness
