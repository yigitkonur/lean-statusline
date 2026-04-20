# Does `/rename` trigger a statusline refresh event?

**Scope:** Status of `#40287` and implications for any idea keyed on session-name changes (e.g. fade-on-rename).
**Last updated:** 2026-04-18
**Confidence:** High — direct issue read, precedent fix referenced (`/model`), docs trigger list confirmed.

## Answer

**No — `/rename` does NOT fire a statusline event.** The custom statusline is re-invoked on assistant message completion, permission mode change, and vim mode toggle (per docs). `/rename` is not in that list. The built-in prompt bar updates the session name instantly, but the custom statusline subprocess is not re-invoked until the next assistant message or other qualifying event. Issue `#40287` is **open** (with `stale` label, updated 2026-04-14) on 2.1.86. OP cites `v2.1.86`'s `/model` refresh fix as precedent and asks for the same treatment for `/rename`, `/color`, and `/config`. Related bug `#44927` ("`/clear` drops session_name from statusline JSON") was fixed 2026-04-15 — so Anthropic is touching the session-name pipeline, just not for `/rename`.

## Evidence

- Issue: [`#40287`](https://github.com/anthropics/claude-code/issues/40287), state: open, opened 2026-03-28, updated 2026-04-14, 2 comments, labels `bug / has repro / platform:windows / area:statusline / stale`.
- OP repro: `/rename my-new-name` → built-in prompt bar updates immediately, custom statusline still shows old `session_name` → any message triggers re-render → custom statusline catches up.
- Comment (Astro-Han): "the statusline subprocess only fires on assistant message completion, permission changes, and a few other events. `/rename` doesn't trigger a re-render. The v2.1.86 fix for `/model` is exactly the right precedent." Also notes the session name updates on the next assistant message, so it's cosmetic rather than data-loss.
- Official docs trigger list (2026-04-18): "after each new assistant message, when the permission mode changes, or when vim mode toggles." `/rename` absent.
- Related closed: [`#44927`](https://github.com/anthropics/claude-code/issues/44927) "`/clear` drops session_name from statusline JSON input (preserved internally)" — closed completed 2026-04-15. Confirms the session-name pipeline is being actively fixed but `/rename` hasn't been addressed.
- Related closed: changelog entry "Fixed `claude --resume <session-id>` losing the session's custom name and color set via `/rename`" — fix shipped in some 2.1.x version. Fixes the persistence side, not the immediate-refresh side.
- Precedent: v2.1.86 changelog (OP cite) reportedly fixed "statusline showing another session's model when using `/model`" — so `/model` now triggers a re-render; `/rename` parallel fix hasn't landed.

### Documented vs inferred

- **Documented:** `/rename` is not a statusline event trigger. The session name IS in the payload (when set) but is only refreshed on the next qualifying event.
- **Inferred:** the fix is likely trivial for Anthropic (emit a statusline-refresh event in the `/rename` handler, matching the `/model` pattern). Hasn't been prioritized despite being filed 3 weeks ago. Staleness suggests it may continue to sit.

## Caveats / Negative Signal

- This is cosmetic-latency only — no data is lost. The session_name field IS correct in the payload on the next event; the statusline just shows the old value until something else triggers a refresh.
- `refreshInterval` would normally mask this (retry every N seconds), BUT `#48445` reports the repaint path is broken for timer ticks — so even `refreshInterval=1` won't reliably catch up.

## Impact on statusline ideas

- **Idea #12 "fade-on-rename":** any animation or visual that needs to *detect* the rename moment cannot rely on an event — the event simply doesn't fire. The only rename-detection path is polling `session_name` in the payload across ticks and noting a change, which requires (a) `refreshInterval` set, and (b) `refreshInterval` repaint to actually work (`#48445` open). So this idea is **currently not reliably doable** without a UI nudge after `/rename`.
- **Any "new session name" indicator:** expect up to a full turn of staleness (until the next assistant response) on the displayed name. Use the name defensively — don't, e.g., display a rename timestamp.
- **Session-name-aware coloring (hash name → color):** works once the first message after rename fires — but if the user renames mid-idle to signal context to themselves, the color won't update until they type.

## Sources

- `anthropics/claude-code#40287` — 2026-03-28, updated 2026-04-14 — primary.
- `anthropics/claude-code#44927` — closed completed 2026-04-15 — `/clear` session_name fix (adjacent pipeline).
- Anthropic changelog 2.1.x — verified `/model` precedent fix and `--resume` session-name fix exist.
- [Customize your status line — Claude Code Docs](https://code.claude.com/docs/en/statusline) — authoritative trigger list.
