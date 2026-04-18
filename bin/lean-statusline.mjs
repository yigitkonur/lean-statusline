#!/usr/bin/env node
// lean-statusline — one-line statusline for Claude Code.
//   no args = render statusline from stdin JSON
//   install | uninstall | config | doctor | version
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig, applyEnvOverrides, validateConfig, DEFAULTS, KNOWN_SEGMENTS, CONFIG_PATH } from '../lib/config.mjs';
import { makePalette, colorsEnabled, pickIcons } from '../lib/colors.mjs';
import { renderLine } from '../lib/segments.mjs';
import { getRateLimits } from '../lib/usage.mjs';
import {
    claudeHome, settingsPath, detectExisting, findOnPath, pickCommand,
    backupSettings, patchSettings, unpatchSettings, smokeTest,
} from '../lib/install.mjs';
import { runDoctor } from '../lib/doctor.mjs';
import { PRESETS, PRESET_NAMES, applyPreset, resolvePresetAlias } from '../lib/presets.mjs';
import { runWizard } from '../lib/wizard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const BIN = __filename;

// ── Entry ───────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv;

async function main() {
    if (!cmd) {
        // No subcommand. If stdin is a tty we know we're NOT being piped
        // JSON by Claude Code — show an interactive menu instead of blocking
        // on stdin forever. Common case: someone types `npx lean-statusline`
        // to explore what the command does.
        if (process.stdin.isTTY) return interactiveMenu();
        return renderFromStdin();
    }
    switch (cmd) {
        case 'install':    return cmdInstall(rest);
        case 'uninstall':  return cmdUninstall(rest);
        case 'config':     return cmdConfig(rest);
        case 'doctor':     return cmdDoctor();
        case 'selfupdate':
        case 'update':     return cmdSelfupdate(rest);
        case 'version':
        case '--version':
        case '-v':        console.log(PKG.version); return;
        case 'help':
        case '--help':
        case '-h':        return printHelp();
        default:
            console.error(`unknown command: ${cmd}\n`);
            printHelp();
            process.exit(2);
    }
}

main().catch(err => {
    // Tools never crash the Claude Code render. Print a minimal fallback and exit 0
    // *only* when invoked as statusline (no subcommand). Subcommands fail loudly.
    if (!cmd) {
        try { process.stdout.write('Claude'); } catch { /* ignore */ }
        process.exit(0);
    }
    console.error(`error: ${err?.message || err}`);
    process.exit(1);
});

// ── interactive menu (shown when TTY + no subcommand) ──
async function interactiveMenu() {
    const BOLD = '\x1b[1m', DIM = '\x1b[2m', RESET = '\x1b[0m';
    const CYAN = '\x1b[36m', GREEN = '\x1b[32m';

    process.stdout.write(`${BOLD}lean-statusline${RESET} ${DIM}v${PKG.version}${RESET}\n`);
    process.stdout.write(`${DIM}${'─'.repeat(60)}${RESET}\n`);
    process.stdout.write(`claude code's statusline — configure and check.\n\n`);
    process.stdout.write(`  ${BOLD}(1)${RESET} install      ${DIM}patch settings.json + smoke test${RESET}\n`);
    process.stdout.write(`  ${BOLD}(2)${RESET} doctor       ${DIM}verify install health${RESET}\n`);
    process.stdout.write(`  ${BOLD}(3)${RESET} config       ${DIM}p10k-style wizard (preset + fine-tune)${RESET}\n`);
    process.stdout.write(`  ${BOLD}(4)${RESET} uninstall    ${DIM}remove statusLine entry${RESET}\n`);
    process.stdout.write(`  ${BOLD}(h)${RESET} help         ${DIM}full command reference${RESET}\n`);
    process.stdout.write(`  ${BOLD}(q)${RESET} quit\n\n`);
    process.stdout.write(`${GREEN}›${RESET} press a key: `);

    const key = await readSingleKey();
    process.stdout.write('\n\n');
    switch (key.toLowerCase()) {
        case '1': return cmdInstall([]);
        case '2': return cmdDoctor();
        case '3': return cmdConfig([]);
        case '4': return cmdUninstall([]);
        case 'h': return printHelp();
        case 'q':
        default:  return;
    }
}

function readSingleKey() {
    return new Promise(resolve => {
        const stdin = process.stdin;
        const wasRaw = stdin.isRaw;
        if (stdin.setRawMode) stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        stdin.once('data', chunk => {
            if (stdin.setRawMode) stdin.setRawMode(wasRaw || false);
            stdin.pause();
            if (chunk === '\x03') process.exit(130);  // Ctrl-C
            resolve(chunk);
        });
    });
}

// ── render ──────────────────────────────────────────────
async function renderFromStdin() {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    let input = {};
    if (raw.trim()) {
        try { input = JSON.parse(raw); } catch { /* empty or malformed = defaults */ }
    }
    if (!raw.trim()) { process.stdout.write('Claude'); return; }

    const { config } = loadConfig();
    const cfg = applyEnvOverrides(config);
    const palette = makePalette(colorsEnabled(undefined, cfg.colors));
    const icons = pickIcons(cfg.icons);
    const rateLimits = await getRateLimits(input);
    const ctx = { input, cfg, palette, icons, rateLimits };
    process.stdout.write(renderLine(ctx));
}

// ── install ─────────────────────────────────────────────
async function cmdInstall(args) {
    const flags = parseFlags(args, {
        '--force': false, '--no-patch': false, '--dir': null,
        '--preset': null, '--wizard': false, '--no-wizard': false, '--via': null,
    });
    if (flags['--dir']) process.env.LEAN_STATUSLINE_CLAUDE_HOME = flags['--dir'];
    if (flags['--via'] && !['npx', 'global', 'node'].includes(flags['--via'])) {
        console.error(`--via must be one of: npx, global, node. got: ${flags['--via']}`);
        process.exit(2);
    }

    const det = detectExisting();
    console.log(`claude home:   ${claudeHome()}`);
    console.log(`settings.json: ${det.settingsExists ? 'exists' : 'will create'}`);
    if (det.currentStatusline) {
        console.log(`current statusline.command: ${det.currentStatusline.command}`);
    }
    if (det.oldBashAt) console.log(`found old bash statusline: ${det.oldBashAt}`);
    if (det.ccline) console.log(`found ccline binary: ${det.ccline}`);
    // Always re-patch on install — the command is idempotent. If the user
    // runs `install` twice they meant it both times. Only --no-patch skips.
    if (det.leanAlreadyInstalled) {
        console.log('lean-statusline already installed — re-patching.');
    }

    const bak = backupSettings();
    if (bak) console.log(`backed up settings → ${bak}`);

    // Apply preset non-interactively, if requested.
    if (flags['--preset']) {
        const resolved = resolvePresetAlias(flags['--preset']);
        if (!PRESET_NAMES.includes(resolved)) {
            console.error(`unknown preset: ${flags['--preset']}. known: ${PRESET_NAMES.join(', ')}`);
            process.exit(2);
        }
        const { config } = loadConfig();
        saveConfig(applyPreset(config, resolved));
        const note = resolved !== flags['--preset'] ? ` (${flags['--preset']} → ${resolved})` : '';
        console.log(`applied preset: ${resolved}${note}`);
    }

    const command = pickCommand(BIN, flags['--via']);
    const runtime = command.startsWith('npx ') ? 'npx (self-updating, ~100–300ms/render)'
                   : command === 'lean-statusline' ? 'global bin (fast)'
                   : 'direct node (from clone)';
    if (!flags['--no-patch']) {
        patchSettings(command);
        console.log(`patched settings.json#statusLine.command = ${command}`);
        console.log(`runtime: ${runtime}`);
    } else {
        console.log('skipped settings.json patch (--no-patch)');
    }

    // Smoke test
    const s = await smokeTest(BIN);
    if (s.ok) console.log(`smoke test passed: ${s.stdout.trim().slice(0, 60)}…`);
    else console.log(`smoke test FAILED: ${s.stderr || 'no output'}`);

    // Launch the configure wizard automatically unless:
    //   - user opted out with --no-wizard
    //   - user already picked a preset via --preset NAME
    //   - we're in a non-TTY (CI/scripted install — wizard would hang)
    //   - --no-patch was set (user is doing a dry-install)
    const shouldRunWizard = !flags['--no-wizard']
        && !flags['--preset']
        && !flags['--no-patch']
        && process.stdin.isTTY
        && process.stdout.isTTY;

    if (shouldRunWizard) {
        console.log('\nlaunching configure wizard (pass --no-wizard to skip)...\n');
        await runWizard();
    } else if (flags['--wizard']) {
        // Explicit --wizard still works for anyone passing it.
        console.log('\nlaunching wizard...');
        await runWizard();
    }

    console.log('\ndone. restart Claude Code to see the new statusline.');
}

// ── uninstall ───────────────────────────────────────────
async function cmdUninstall(_args) {
    const bak = backupSettings();
    const changed = unpatchSettings();
    if (changed) {
        console.log(`removed statusLine from ${settingsPath()}`);
        if (bak) console.log(`backup → ${bak}`);
    } else {
        console.log('no statusLine entry to remove.');
    }
}

// ── config ──────────────────────────────────────────────
async function cmdConfig(args) {
    if (args[0] === '--show') {
        const { config, path, warning } = loadConfig();
        console.log(`# ${path}${existsSync(path) ? '' : '  (not yet created — showing defaults)'}`);
        if (warning) console.log(`# WARNING: ${warning}`);
        console.log(JSON.stringify(config, null, 2));
        return;
    }
    if (args[0] === '--preset') {
        if (!args[1]) {
            console.log('available presets:');
            for (const n of PRESET_NAMES) console.log(`  ${n.padEnd(10)} ${PRESETS[n].description}`);
            return;
        }
        const resolved = resolvePresetAlias(args[1]);
        if (!PRESET_NAMES.includes(resolved)) {
            console.error(`unknown preset: ${args[1]}. known: ${PRESET_NAMES.join(', ')}`);
            process.exit(2);
        }
        const { config } = loadConfig();
        saveConfig(applyPreset(config, resolved));
        const note = resolved !== args[1] ? ` (${args[1]} → ${resolved})` : '';
        console.log(`applied preset "${resolved}"${note} → ${CONFIG_PATH}`);
        return;
    }
    if (args[0] === '--reset') {
        saveConfig(DEFAULTS);
        console.log(`reset ${CONFIG_PATH} to defaults.`);
        return;
    }
    if (args[0] === '--edit') {
        const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
        const { config } = loadConfig();
        if (!existsSync(CONFIG_PATH)) saveConfig(config);
        const { spawnSync } = await import('node:child_process');
        spawnSync(editor, [CONFIG_PATH], { stdio: 'inherit' });
        const after = loadConfig();
        const errs = validateConfig(after.config);
        if (errs.length) {
            console.error('config has errors after edit:');
            for (const e of errs) console.error(`  - ${e}`);
            process.exit(1);
        }
        console.log('config ok.');
        return;
    }
    if (args[0] === '--set') {
        if (args.length < 2) { console.error('usage: lean-statusline config --set key=value [key=value ...]'); process.exit(2); }
        const { config } = loadConfig();
        for (const pair of args.slice(1)) {
            const eq = pair.indexOf('=');
            if (eq < 0) { console.error(`invalid: ${pair} (expected key=value)`); process.exit(2); }
            const key = pair.slice(0, eq);
            const val = pair.slice(eq + 1);
            applySet(config, key, val);
        }
        const errs = validateConfig(config);
        if (errs.length) {
            console.error('resulting config invalid:');
            for (const e of errs) console.error(`  - ${e}`);
            process.exit(1);
        }
        saveConfig(config);
        console.log(`wrote ${CONFIG_PATH}`);
        return;
    }
    // Interactive p10k-style wizard (default when `config` has no args)
    return runWizard();
}

function applySet(cfg, key, val) {
    // Support dotted keys: show.branch, thresholds.warn, segments (comma list).
    if (key === 'segments') { cfg.segments = val.split(',').map(s => s.trim()).filter(Boolean); return; }
    if (key === 'icons') { cfg.icons = val; return; }
    if (key === 'colors') { cfg.colors = val === 'true' || val === '1'; return; }
    if (key === 'separator') { cfg.separator = val; return; }
    const parts = key.split('.');
    let cur = cfg;
    for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] ??= {};
        cur = cur[parts[i]];
    }
    const leaf = parts[parts.length - 1];
    // Try number, bool, else string.
    if (val === 'true') cur[leaf] = true;
    else if (val === 'false') cur[leaf] = false;
    else if (!isNaN(Number(val)) && val.trim() !== '') cur[leaf] = Number(val);
    else cur[leaf] = val;
}

// ── selfupdate ──────────────────────────────────────────
// Global installs are the only flavor that doesn't auto-update. npx-patched
// configs re-resolve @latest on each render. Clone installs update via git
// pull. Global installs stay frozen at whatever version was `npm install -g`d.
async function cmdSelfupdate(args) {
    const flags = parseFlags(args, { '--version': null, '--check': false });
    const target = flags['--version'] || 'latest';

    const { spawnSync } = await import('node:child_process');
    console.log('checking registry for latest version...');
    const viewResult = spawnSync('npm', ['view', `lean-statusline@${target}`, 'version'], { encoding: 'utf8' });
    if (viewResult.status !== 0) {
        console.error('could not reach npm registry.');
        console.error(viewResult.stderr || 'no stderr');
        process.exit(1);
    }
    const registryVersion = viewResult.stdout.trim();
    console.log(`current: ${PKG.version}  ·  registry: ${registryVersion}`);
    if (registryVersion === PKG.version) {
        console.log('already on the latest version.');
        return;
    }
    if (flags['--check']) {
        console.log(`update available: ${PKG.version} → ${registryVersion}`);
        console.log(`run  \`lean-statusline selfupdate\`  to apply.`);
        return;
    }

    console.log(`upgrading ${PKG.version} → ${registryVersion}...`);
    const install = spawnSync('npm', ['install', '-g', `lean-statusline@${target}`], {
        encoding: 'utf8', stdio: 'inherit',
    });
    if (install.status !== 0) {
        console.error('npm install -g failed.');
        console.error('  on macOS with homebrew-managed node, the global prefix is writable without sudo.');
        console.error('  if you see EACCES, either re-run with sudo or follow the npm docs on fixing permissions:');
        console.error('    https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally');
        process.exit(install.status ?? 1);
    }
    console.log(`done. next statusline render picks up ${registryVersion}.`);
}

// ── doctor ──────────────────────────────────────────────
async function cmdDoctor() {
    const { report, fails } = await runDoctor(BIN);
    console.log(report);
    process.exit(fails ? 1 : 0);
}

// ── help / flags ────────────────────────────────────────
function parseFlags(args, spec) {
    const out = { ...spec };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a in out) {
            if (out[a] === false) out[a] = true;
            else out[a] = args[++i];
        }
    }
    return out;
}

function printHelp() {
    console.log(`lean-statusline — statusline for Claude Code

usage:
  lean-statusline                              render (stdin = Claude Code JSON)
  lean-statusline install [opts]               install + patch settings.json (idempotent)
                                               launches configure wizard afterward in a tty
    --no-wizard                                skip the wizard (scripted installs)
    --via npx|global|node                      force runtime (default: auto-detect)
    --no-patch                                 don't touch settings.json
    --dir PATH                                 override ~/.claude location
    --preset NAME                              apply preset (minimal|compact|full; classic → full)
  lean-statusline uninstall
  lean-statusline config                       p10k-style interactive wizard
  lean-statusline config --show                print current config
  lean-statusline config --preset [NAME]       list or apply a preset
  lean-statusline config --set key=value [..]  set values
  lean-statusline config --edit                open config in \$EDITOR
  lean-statusline config --reset               reset to defaults
  lean-statusline doctor                       verify install health
  lean-statusline selfupdate [--check] [--version X]
                                               upgrade the global install via npm
  lean-statusline version

presets:
  ${PRESET_NAMES.map(n => `${n.padEnd(10)} ${PRESETS[n].description}`).join('\n  ')}

config file:  ${CONFIG_PATH}
repo:         ${PKG.homepage}
`);
}
