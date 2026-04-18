// Presets are starting templates — pick one, then fine-tune.
// Each preset is a full config, not a patch. Applying a preset replaces
// segments/show/separator/contextBarWidth but leaves icons/colors/thresholds
// alone so those render-environment choices persist across preset changes.

// Note: every preset leads with `ssh`. That segment is silent on local
// sessions (returns null so no chrome appears) and surfaces a 🔒 <host>
// prefix when SSH_CONNECTION is set. Leading with it means remote sessions
// get the "not my laptop" signal for free, without the user configuring
// anything. Local users never see it so there's zero cost.
export const PRESETS = {
    minimal: {
        name: 'minimal',
        description: 'one line. model · ctx · dir · 5h · 7d. (silent 🔒 <host> prefix when on ssh.)',
        sample: `Opus 4.7 · ✎ 2% · repo (main) · 5h 40% · 7d 47%`,
        config: {
            segments: ['ssh', 'model', 'ctx', 'dir', '5h', '7d'],
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
            segments: ['ssh', 'model', 'ctx', 'dir', '\n', 'rate-5h-full', 'rate-7d-full'],
            show: { branch: true, dirty: true, zap: true, bars: true },
            separator: '·',
        },
    },

    full: {
        name: 'full',
        description: 'three lines. header + cost/lines + rate bars + context bar.',
        sample: [
            `Opus 4.7 · ✎ 2% · repo (main) · ◐ auto · $ $0.23 · +156 -23 · ⏱ 45m 12s`,
            `current ●●●●○○○○○○  40% ⟳ 6:00am (in 1h31m) · weekly ●●●○○○○○○○  47% ⟳ apr 23, 12:00pm (in 5d7h)`,
            `context ●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○`,
        ].join('\n'),
        config: {
            segments: [
                'ssh', 'model', 'ctx', 'dir', 'effort', 'cost', 'lines', 'elapsed',
                '\n', 'rate-5h-full', 'rate-7d-full',
                '\n', 'context-bar',
            ],
            show: { branch: true, dirty: true, zap: true, bars: true },
            separator: '·',
            contextBarWidth: 88,
        },
    },

    classic: {
        name: 'classic',
        description: "four+ lines. old bash statusline replica — with cost, lines, overflow badge, and ▶▶ bypass-permissions banner.",
        sample: [
            `Opus 4.7 · ✎ 0% · ⚡ repo (main) · ◐ auto · [my-session] · $ $0.23 · +156 -23 · ⏱ 45m 12s`,
            `current ●●●●○○○○○○  40% ⟳ 6:00am (in 1h31m) · weekly ●●●○○○○○○○  47% ⟳ apr 23, 12:00pm (in 5d7h)`,
            `context ●●●●●●○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○○`,
            `⚠ >200k`,
            `▶▶ bypass permissions on (shift+tab to cycle)`,
        ].join('\n'),
        config: {
            segments: [
                'ssh', 'model', 'ctx', 'dir', 'effort', 'session-name',
                'cost', 'lines', 'elapsed', 'agent', 'vim', 'output-style',
                '\n', 'rate-5h-full', 'rate-7d-full',
                '\n', 'context-bar',
                '\n', 'overflow',
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
