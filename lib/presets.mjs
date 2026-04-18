// Presets are starting templates — pick one, then fine-tune.
// Each preset is a full config, not a patch. Applying a preset replaces
// segments/show/separator/contextBarWidth but leaves icons/colors/thresholds
// alone so those render-environment choices persist across preset changes.

export const PRESETS = {
    minimal: {
        name: 'minimal',
        description: 'one line. model · ctx · dir · 5h · 7d.',
        sample: `Opus 4.7 · ✎ 2% · repo (main) · 5h 40% · 7d 47%`,
        config: {
            segments: ['model', 'ctx', 'dir', '5h', '7d'],
            show: { branch: true, dirty: true, zap: true, bars: false },
            separator: '·',
        },
    },

    compact: {
        name: 'compact',
        description: 'two lines. header + rate-limit bars with reset times.',
        sample: [
            `Opus 4.7 · ✎ 2% · repo (main)`,
            `current ●●●●○○○○○○  40% ⟳ 6:00am (in 1h31m) · weekly ●●●○○○○○○○  47% ⟳ apr 23, 12:00pm (in 5d7h)`,
        ].join('\n'),
        config: {
            segments: ['model', 'ctx', 'dir', '\n', 'rate-5h-full', 'rate-7d-full'],
            show: { branch: true, dirty: true, zap: true, bars: true },
            separator: '·',
        },
    },

    full: {
        name: 'full',
        description: 'three lines. header + rate bars + full-width context bar.',
        sample: [
            `Opus 4.7 · ✎ 2% · repo (main) · ◐ auto`,
            `current ●●●●○○○○○○  40% ⟳ 6:00am (in 1h31m) · weekly ●●●○○○○○○○  47% ⟳ apr 23, 12:00pm (in 5d7h)`,
            `context ●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○`,
        ].join('\n'),
        config: {
            segments: ['model', 'ctx', 'dir', 'effort', '\n', 'rate-5h-full', 'rate-7d-full', '\n', 'context-bar'],
            show: { branch: true, dirty: true, zap: true, bars: true },
            separator: '·',
            contextBarWidth: 88,
        },
    },

    classic: {
        name: 'classic',
        description: "four lines. exact match of the old bash statusline (with ▶▶ bypass-permissions banner when active).",
        sample: [
            `Opus 4.7 · ✎ 0% · ⚡ repo (main) · ◐ auto`,
            `current ●●●●○○○○○○  40% ⟳ 6:00am (in 1h31m) · weekly ●●●○○○○○○○  47% ⟳ apr 23, 12:00pm (in 5d7h)`,
            `context ●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○`,
            `▶▶ bypass permissions on (shift+tab to cycle)`,
        ].join('\n'),
        config: {
            segments: [
                'model', 'ctx', 'dir', 'effort',
                '\n', 'rate-5h-full', 'rate-7d-full',
                '\n', 'context-bar',
                '\n', 'bypass-banner',
            ],
            show: { branch: true, dirty: true, zap: true, bars: true },
            separator: '·',
            contextBarWidth: 88,
        },
    },
};

export const PRESET_NAMES = Object.keys(PRESETS);

export function applyPreset(current, presetName) {
    const p = PRESETS[presetName];
    if (!p) throw new Error(`unknown preset: ${presetName}. known: ${PRESET_NAMES.join(', ')}`);
    return {
        ...current,
        ...p.config,
        preset: presetName,
        show: { ...current.show, ...p.config.show },
    };
}
