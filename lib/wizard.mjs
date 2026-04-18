// p10k-style configure wizard.
//   - preview at top, question at bottom
//   - single-key input (no enter needed), via raw-mode stdin
//   - q quits at any point, r restarts
//   - capability tests by visual confirmation, not silent autodetect
//   - preset pick → fine-tune, exactly like p10k configure
//
// Portable across iTerm/Ghostty/WezTerm/Terminal/Warp/Windows Terminal etc.
import { makePalette, pickIcons, colorsEnabled } from './colors.mjs';
import { PRESETS, PRESET_NAMES, applyPreset } from './presets.mjs';
import { DEFAULTS, loadConfig, saveConfig, CONFIG_PATH } from './config.mjs';
import { renderLine } from './segments.mjs';
import { tmpdir } from 'node:os';

const CLEAR = '\x1b[2J\x1b[H';   // clear + cursor home
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Read a single keypress from stdin. Returns the raw string (length 1 usually).
function readKey() {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const wasRaw = stdin.isRaw;
        if (stdin.setRawMode) stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        const onData = (chunk) => {
            stdin.removeListener('data', onData);
            stdin.pause();
            if (stdin.setRawMode) stdin.setRawMode(wasRaw || false);
            // Ctrl-C
            if (chunk === '\x03') process.exit(130);
            resolve(chunk);
        };
        stdin.on('data', onData);
    });
}

function printHeader(title, stepInfo) {
    process.stdout.write(CLEAR);
    process.stdout.write(`${BOLD}lean-statusline · configure${RESET}  ${DIM}${stepInfo}${RESET}\n`);
    process.stdout.write(`${DIM}${'─'.repeat(72)}${RESET}\n`);
    if (title) process.stdout.write(`${BOLD}${title}${RESET}\n\n`);
}

function printPreview(cfg, sampleInput) {
    const palette = makePalette(colorsEnabled(undefined, cfg.colors));
    const icons = pickIcons(cfg.icons);
    const ctx = { input: sampleInput, cfg, palette, icons, rateLimits: sampleInput.rateLimits };
    const line = renderLine(ctx);
    const box = `${DIM}preview${RESET}\n${line}\n`;
    process.stdout.write(`${box}\n${DIM}${'─'.repeat(72)}${RESET}\n`);
}

function printQuestion(q, options) {
    process.stdout.write(`${q}\n\n`);
    for (const [key, label] of options) {
        process.stdout.write(`  ${BOLD}(${key})${RESET}  ${label}\n`);
    }
    process.stdout.write(`\n${DIM}press a key${RESET} › `);
}

const SAMPLE_INPUT = {
    model: { display_name: 'Opus 4.7 (1M context)' },
    context_window: { context_window_size: 1000000, current_usage: { input_tokens: 20000, cache_read_input_tokens: 5000 } },
    cwd: process.cwd(),
    session: { start_time: new Date(Date.now() - 83 * 60 * 1000).toISOString() },
    rateLimits: {
        fiveHour: { pct: 40, resetsAt: Date.now() + 91 * 60 * 1000 },
        sevenDay: { pct: 47, resetsAt: Date.now() + (5 * 24 + 7) * 60 * 60 * 1000 },
        source: 'sample',
    },
};

// ── Questions ───────────────────────────────────────────
async function askUnicode(cfg) {
    printHeader('does your terminal render these glyphs cleanly?', 'step 1 / 5');
    process.stdout.write(`  ✎   ⏱   ⚡   ⟳   ●○   ▶▶\n\n`);
    printQuestion('if any are tofu boxes or missing, pick ascii.', [
        ['1', 'yes, render them as unicode'],
        ['2', 'no, use ascii fallback (% t ! ~ # - >>)'],
        ['q', 'quit without saving'],
    ]);
    while (true) {
        const k = (await readKey()).toLowerCase();
        if (k === '1') return { ...cfg, icons: 'unicode' };
        if (k === '2') return { ...cfg, icons: 'ascii' };
        if (k === 'q') process.exit(0);
    }
}

async function askColors(cfg) {
    printHeader('do you see four different colors below?', 'step 2 / 5');
    const p = makePalette(true);
    process.stdout.write(`  ${p.green('green')}   ${p.orange('orange')}   ${p.yellow('yellow')}   ${p.red('red')}\n\n`);
    printQuestion('these are the percentage-threshold colors. if your theme is mangling them, pick no.', [
        ['1', 'yes, use colors'],
        ['2', 'no, render without colors'],
        ['q', 'quit without saving'],
    ]);
    while (true) {
        const k = (await readKey()).toLowerCase();
        if (k === '1') return { ...cfg, colors: true };
        if (k === '2') return { ...cfg, colors: false };
        if (k === 'q') process.exit(0);
    }
}

async function askPreset(cfg) {
    let current = cfg;
    while (true) {
        printHeader('pick a preset', 'step 3 / 5');
        process.stdout.write(`${DIM}every preset leads with a silent \`ssh\` segment — no chrome locally, shows 🔒 <host> when you're on a remote box.${RESET}\n\n`);
        for (const [idx, name] of PRESET_NAMES.entries()) {
            const p = PRESETS[name];
            process.stdout.write(`${BOLD}(${idx + 1}) ${p.name}${RESET}  ${DIM}— ${p.description}${RESET}\n`);
            // Render the preset's sample with the user's chosen icons/colors.
            const preview = applyPreset(current, name);
            const palette = makePalette(colorsEnabled(undefined, preview.colors));
            const icons = pickIcons(preview.icons);
            const ctx = { input: SAMPLE_INPUT, cfg: preview, palette, icons, rateLimits: SAMPLE_INPUT.rateLimits };
            const line = renderLine(ctx);
            process.stdout.write(line.split('\n').map(l => `    ${l}`).join('\n') + '\n\n');
        }
        printQuestion('which preset should we start from? you can fine-tune after.', [
            ['1', 'minimal'],
            ['2', 'compact'],
            ['3', 'full'],
            ['4', 'classic'],
            ['q', 'quit without saving'],
        ]);
        const k = (await readKey()).toLowerCase();
        if (k === '1') return applyPreset(current, 'minimal');
        if (k === '2') return applyPreset(current, 'compact');
        if (k === '3') return applyPreset(current, 'full');
        if (k === '4') return applyPreset(current, 'classic');
        if (k === 'q') process.exit(0);
    }
}

async function askSeparator(cfg) {
    const choices = [
        ['1', '·', 'middle dot (default)'],
        ['2', '|', 'pipe'],
        ['3', '→', 'arrow'],
        ['4', '•', 'bullet'],
        ['5', ':', 'colon'],
    ];
    while (true) {
        printHeader('pick a segment separator', 'step 4 / 5');
        printPreview(cfg, SAMPLE_INPUT);
        for (const [key, sym, label] of choices) {
            process.stdout.write(`  ${BOLD}(${key})${RESET}  ${sym}  ${DIM}— ${label}${RESET}\n`);
        }
        process.stdout.write(`  ${BOLD}(k)${RESET}  keep current (${cfg.separator})\n`);
        process.stdout.write(`  ${BOLD}(q)${RESET}  quit without saving\n\n${DIM}press a key${RESET} › `);
        const k = (await readKey()).toLowerCase();
        if (k === 'k') return cfg;
        if (k === 'q') process.exit(0);
        const hit = choices.find(c => c[0] === k);
        if (hit) return { ...cfg, separator: hit[1] };
    }
}

async function askBranch(cfg) {
    printHeader('show the git branch on the dir segment?', 'step 5 / 5');
    printPreview(cfg, SAMPLE_INPUT);
    printQuestion('hides if you find it noisy outside git repos.', [
        ['1', 'yes, show (branch) next to dir'],
        ['2', 'no, just the dir name'],
        ['q', 'quit without saving'],
    ]);
    while (true) {
        const k = (await readKey()).toLowerCase();
        if (k === '1') return { ...cfg, show: { ...cfg.show, branch: true } };
        if (k === '2') return { ...cfg, show: { ...cfg.show, branch: false } };
        if (k === 'q') process.exit(0);
    }
}

async function askSave(cfg) {
    printHeader('ready to save', 'done');
    printPreview(cfg, SAMPLE_INPUT);
    process.stdout.write(`${DIM}this will write${RESET} ${CONFIG_PATH}\n\n`);
    printQuestion('save now?', [
        ['1', `yes, write to ${CONFIG_PATH}`],
        ['2', 'no, print the config to stdout instead'],
        ['q', 'quit without saving'],
    ]);
    while (true) {
        const k = (await readKey()).toLowerCase();
        if (k === '1') return 'save';
        if (k === '2') return 'print';
        if (k === 'q') process.exit(0);
    }
}

export async function runWizard() {
    // Require a TTY — raw-mode keystrokes need it.
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error('wizard needs a tty. run in a real terminal, or use --set flags.');
        process.exit(1);
    }

    process.stdout.write(HIDE_CURSOR);
    process.on('exit', () => process.stdout.write(SHOW_CURSOR + '\n'));

    let cfg = { ...DEFAULTS, ...(loadConfig().config) };

    try {
        cfg = await askUnicode(cfg);
        cfg = await askColors(cfg);
        cfg = await askPreset(cfg);
        cfg = await askSeparator(cfg);
        cfg = await askBranch(cfg);
        const action = await askSave(cfg);
        process.stdout.write(CLEAR);
        process.stdout.write(SHOW_CURSOR);

        if (action === 'save') {
            saveConfig(cfg);
            console.log(`✓ saved ${CONFIG_PATH}\n`);
            console.log(`preview:`);
            const palette = makePalette(colorsEnabled(undefined, cfg.colors));
            const icons = pickIcons(cfg.icons);
            const ctx = { input: SAMPLE_INPUT, cfg, palette, icons, rateLimits: SAMPLE_INPUT.rateLimits };
            console.log(renderLine(ctx));
            console.log(`\nrun \`lean-statusline doctor\` to verify.`);
        } else {
            console.log(JSON.stringify(cfg, null, 2));
        }
    } finally {
        process.stdout.write(SHOW_CURSOR);
    }
}
