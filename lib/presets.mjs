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
export const PRESETS = {
    minimal: {
        name: 'minimal',
        description: 'essentials, one line.',
        sample: `🔒 mac-mini · Opus 4.7 · ✎ 3% · repo (main) · 5h 40% · 7d 47%`,
        config: {
            segments: ['ssh', 'model', 'ctx', 'dir', '5h', '7d'],
            show: { branch: true, dirty: true, zap: true, bars: false, subagents: false },
            separator: '·',
        },
    },

    compact: {
        name: 'compact',
        description: 'adds rate bars + countdowns. default.',
        sample: [
            `🔒 mac-mini · Opus 4.7 · ✎ 3% · repo (main)`,
            `current ●●●●○○○○○○  40% (in 1h31m) · weekly ●●●○○○○○○○  47% (in 5d7h)`,
        ].join('\n'),
        config: {
            segments: ['ssh', 'model', 'ctx', 'dir', 'subagents', '\n', 'rate-5h-full', 'rate-7d-full'],
            show: { branch: true, dirty: true, zap: true, bars: true, subagents: true },
            separator: '·',
        },
    },

    full: {
        name: 'full',
        description: 'everything useful. silent segments appear only when active.',
        sample: [
            `🔒 mac-mini · Opus 4.7 · ✎ 3% · repo (main) · ◐ auto`,
            `current ●●●●○○○○○○  40% (in 1h31m) · weekly ●●●○○○○○○○  47% (in 5d6h)`,
            `context ●●●●●●●●●●●●●●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○○○○○○ 26k`,
        ].join('\n'),
        config: {
            segments: [
                // header
                'ssh', 'model', 'ctx', 'dir', 'subagents', 'effort', 'session-name',
                'agent', 'vim', 'output-style',
                // rate bars
                '\n', 'rate-5h-full', 'rate-7d-full',
                // context strip (token badge + update notice appended inline)
                '\n', 'context-bar',
                // transient pace-explainer row (silent unless 5h will exhaust before reset)
                '\n', 'pace-explainer',
                // conditional banners (silent unless triggered).
                // `bypass-banner` was removed from defaults — CC 2.x renders
                // its own "▶▶ bypass permissions on · N shells" chrome directly
                // below the statusline, so our copy is redundant duplicate. Users
                // on older CC can still opt it back in via custom segments.
                '\n', 'overflow',
            ],
            show: { branch: true, dirty: true, zap: true, bars: true, subagents: true, contextTokens: true, ccUpdate: true },
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
