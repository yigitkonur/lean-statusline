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
            show: { branch: true, dirty: true, zap: true, bars: false },
            separator: '·',
        },
    },

    compact: {
        name: 'compact',
        description: 'adds rate bars + reset times.',
        sample: [
            `🔒 mac-mini · Opus 4.7 · ✎ 3% · repo (main)`,
            `current ●●●●○○○○○○  40% ⟳ 6:00am (in 1h31m) · weekly ●●●○○○○○○○  47% ⟳ apr 23, 12:00pm (in 5d7h)`,
        ].join('\n'),
        config: {
            segments: ['ssh', 'model', 'ctx', 'dir', '\n', 'rate-5h-full', 'rate-7d-full'],
            show: { branch: true, dirty: true, zap: true, bars: true },
            separator: '·',
        },
    },

    full: {
        name: 'full',
        description: 'everything useful. silent segments appear only when active.',
        sample: [
            `🔒 mac-mini · Opus 4.7 · ✎ 3% · repo (main) · ◐ auto · $0.23 · +156 -23 · ⏱ 45m`,
            `current ●●●●○○○○○○  40% ⟳ 6:00am (in 1h31m) · weekly ●●●○○○○○○○  47% ⟳ apr 23, 12:20pm (in 5d6h)`,
            `context ●●●●●●●●●●●●●●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○`,
        ].join('\n'),
        config: {
            segments: [
                // header
                'ssh', 'model', 'ctx', 'dir', 'effort', 'session-name',
                'cost', 'lines', 'elapsed', 'agent', 'vim', 'output-style',
                // rate bars
                '\n', 'rate-5h-full', 'rate-7d-full',
                // context strip
                '\n', 'context-bar',
                // conditional banners (silent unless triggered)
                '\n', 'overflow',
                '\n', 'bypass-banner',
            ],
            show: { branch: true, dirty: true, zap: true, bars: true },
            separator: '·',
            contextBarWidth: 75,
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
