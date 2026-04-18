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
import { PRESETS, PRESET_NAMES, applyPreset } from '../lib/presets.mjs';
import { runWizard } from '../lib/wizard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const BIN = __filename;

// ── Entry ───────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv;

async function main() {
    if (!cmd) return renderFromStdin();
    switch (cmd) {
        case 'install':   return cmdInstall(rest);
        case 'uninstall': return cmdUninstall(rest);
        case 'config':    return cmdConfig(rest);
        case 'doctor':    return cmdDoctor();
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
        '--preset': null, '--wizard': false,
    });
    if (flags['--dir']) process.env.LEAN_STATUSLINE_CLAUDE_HOME = flags['--dir'];

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
        if (!PRESET_NAMES.includes(flags['--preset'])) {
            console.error(`unknown preset: ${flags['--preset']}. known: ${PRESET_NAMES.join(', ')}`);
            process.exit(2);
        }
        const { config } = loadConfig();
        saveConfig(applyPreset(config, flags['--preset']));
        console.log(`applied preset: ${flags['--preset']}`);
    }

    const command = pickCommand(BIN);
    if (!flags['--no-patch']) {
        patchSettings(command);
        console.log(`patched settings.json#statusLine.command = ${command}`);
    } else {
        console.log('skipped settings.json patch (--no-patch)');
    }

    // Smoke test
    const s = await smokeTest(BIN);
    if (s.ok) console.log(`smoke test passed: ${s.stdout.trim().slice(0, 60)}…`);
    else console.log(`smoke test FAILED: ${s.stderr || 'no output'}`);

    // Offer wizard (if tty) or run it automatically when --wizard.
    if (flags['--wizard']) {
        console.log('\nlaunching wizard...');
        await runWizard();
    } else if (process.stdin.isTTY && !flags['--preset']) {
        console.log('\ntip: run `lean-statusline config` to pick a preset and fine-tune (4 presets: minimal / compact / full / classic).');
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
        if (!PRESET_NAMES.includes(args[1])) {
            console.error(`unknown preset: ${args[1]}. known: ${PRESET_NAMES.join(', ')}`);
            process.exit(2);
        }
        const { config } = loadConfig();
        saveConfig(applyPreset(config, args[1]));
        console.log(`applied preset "${args[1]}" → ${CONFIG_PATH}`);
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
  lean-statusline install [opts]               install + patch settings.json
    --force                                    re-patch even if already installed
    --no-patch                                 don't touch settings.json
    --dir PATH                                 override ~/.claude location
    --preset NAME                              apply preset (minimal|compact|full|classic)
    --wizard                                   launch configure wizard after install
  lean-statusline uninstall
  lean-statusline config                       p10k-style interactive wizard
  lean-statusline config --show                print current config
  lean-statusline config --preset [NAME]       list or apply a preset
  lean-statusline config --set key=value [..]  set values
  lean-statusline config --edit                open config in \$EDITOR
  lean-statusline config --reset               reset to defaults
  lean-statusline doctor                       verify install health
  lean-statusline version

presets:
  ${PRESET_NAMES.map(n => `${n.padEnd(10)} ${PRESETS[n].description}`).join('\n  ')}

config file:  ${CONFIG_PATH}
repo:         ${PKG.homepage}
`);
}
