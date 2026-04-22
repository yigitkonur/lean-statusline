// Presets are starting templates — pick one, then fine-tune.
// Each preset is a full config, not a patch. Applying a preset replaces
// segments/show/separator/contextBarWidth but leaves icons/colors/thresholds
// alone so those render-environment choices persist across preset changes.

// Every preset leads with `ssh` — silent locally, shows 🔒 <host> on
// remote. This is non-negotiable: when Claude Code is running on a box
// that isn't your laptop, you want that signal regardless of preset.
//
// Three presets as of 0.3.8. The previous `classic` preset was merged
// into `full` — it only added segments that are silent-when-absent
// (overflow, session-name, agent, vim, output-style, bypass-banner),
// so the two looked identical 99% of the time. Zero feature loss.
// Legacy `classic` in user configs auto-migrates to `full` via
// applyPreset (see resolvePresetAlias below).
// Iteration order governs the wizard's left/right cycle on step 1: user
// starts at `full` (tallest preview, most features) and steps down toward
// `minimal`. 1.5.4 reorder — prior order ran minimal → compact → full,
// which under-sold the defaults on the first keypress.
export const PRESETS = {
    full: {
        name: 'full',
        description: 'header + rate bars + context + pace alerts. silent segments show only when active.',
        sample: [
            `Opus 4.7 · context 3% · ~/repo · ◐ auto · ⏱ 45m · 🤖×2`,
            `current ●●●●○○○○○○  40% (in 1h31m) · weekly ●●●○○○○○○○  47% (in 5d6h)`,
            `context ●●●●●●●●●●●●●●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○○○○○○ 26k`,
        ].join('\n'),
        config: {
            // 1.5.0 segment list. User-facing spec:
            //   - ctx + pace-explainer are LOCKED ON in the wizard (always rendered).
            //   - model/dir/rate-5h-full/rate-7d-full/context-bar on by default.
            //   - ssh is OFF by default (1.5.2) — opt in via wizard page 4.
            //   - effort/elapsed/agent/subagents/overflow on by default but silent
            //     when their underlying data is absent.
            //   - cost/lines/worktree/vim/session-name/output-style/bypass-banner/
            //     5h/7d are NOT in the default list — user opts in via wizard step 5.
            segments: [
                // header line
                'model', 'ctx', 'dir',
                'effort', 'elapsed', 'agent', 'subagents', 'overflow',
                // rate-bars line
                '\n', 'rate-5h-full', 'rate-7d-full',
                // context-usage line (token badge + update notice append inline)
                '\n', 'context-bar',
                // transient pace-explainer row (locked-on; silent unless 5h will
                // exhaust before reset)
                '\n', 'pace-explainer',
            ],
            show: {
                branch: false,        // off by default per 1.5.0 user spec
                dirty: true,
                ctxLabel: 'text',     // `context 32%` rather than `✎ 32%`
                subagents: true,
                contextTokens: true,
                ccUpdate: true,
            },
            separator: '·',
            contextBarWidth: 60,
            // 5s keeps countdown timers visually live (resets_at math is client-side)
            // without spawning the script every second. rate_limits values only change
            // on API calls, so sub-5s polling adds no accuracy. (See research: docs/research/refresh-interval/00-findings.md)
            refreshInterval: 5,
            transcript: {
                enabled: true,
                maxFirstReadMs: 500,
                reducers: ['lastTool', 'failStreak', 'subagents', 'cacheRatio'],
            },
        },
    },

    compact: {
        name: 'compact',
        description: 'adds rate bars + countdowns. default.',
        sample: [
            `Opus 4.7 · context 3% · ~/repo`,
            `current ●●●●○○○○○○  40% (in 1h31m) · weekly ●●●○○○○○○○  47% (in 5d7h)`,
        ].join('\n'),
        config: {
            segments: ['model', 'ctx', 'dir', 'subagents', '\n', 'rate-5h-full', 'rate-7d-full'],
            show: { branch: false, dirty: true, subagents: true, ctxLabel: 'text' },
            separator: '·',
        },
    },

    minimal: {
        name: 'minimal',
        description: 'essentials, one line.',
        sample: `Opus 4.7 · context 3% · ~/repo`,
        config: {
            // 1.5.2: `ssh` is off by default across all presets — users opt in
            // via the wizard's core-segments page. Most sessions are local,
            // and the preview looked cluttered showing 🔒 <host> by default
            // when the toggle was effectively always-on.
            segments: ['model', 'ctx', 'dir', 'rate-5h-full', 'rate-7d-full'],
            show: { branch: false, dirty: true, ctxLabel: 'text', subagents: false },
            separator: '·',
        },
    },
};

// Back-compat: `classic` was removed in 0.3.8 (merged into `full`).
// Quietly redirect old configs so nobody's statusline breaks on upgrade.
const LEGACY_ALIASES = Object.freeze({ classic: 'full' });
export function resolvePresetAlias(name) {
    return LEGACY_ALIASES[name] || name;
}

export const PRESET_NAMES = Object.keys(PRESETS);

export function applyPreset(current, presetName) {
    const resolved = resolvePresetAlias(presetName);
    const p = PRESETS[resolved];
    if (!p) throw new Error(`unknown preset: ${presetName}. known: ${PRESET_NAMES.join(', ')}`);
    return {
        ...current,
        ...p.config,
        preset: resolved,
        show: { ...current.show, ...p.config.show },
    };
}
