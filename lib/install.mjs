// install/uninstall/doctor logic.
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function claudeHome() {
    return process.env.LEAN_STATUSLINE_CLAUDE_HOME || join(homedir(), '.claude');
}

export function settingsPath() {
    return join(claudeHome(), 'settings.json');
}

// Find the `lean-statusline` binary on PATH. Returns absolute path or null.
export function findOnPath() {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(which, ['lean-statusline'], { encoding: 'utf8' });
    if (r.status !== 0) return null;
    return r.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || null;
}

// Detect what statusline is currently configured.
export function detectExisting() {
    const sp = settingsPath();
    const report = {
        settingsExists: existsSync(sp),
        settings: null,
        currentStatusline: null,
        oldBashAt: null,
        ccline: null,
        leanAlreadyInstalled: false,
    };
    if (report.settingsExists) {
        try {
            report.settings = JSON.parse(readFileSync(sp, 'utf8'));
            report.currentStatusline = report.settings.statusLine || null;
        } catch { /* ignore */ }
    }
    const sh = join(claudeHome(), 'statusline.sh');
    if (existsSync(sh)) report.oldBashAt = sh;
    const ccl = join(claudeHome(), 'ccline', 'ccline');
    if (existsSync(ccl)) report.ccline = ccl;
    const leanSh = join(claudeHome(), 'lean-statusline.sh');
    if (existsSync(leanSh)) report.oldBashAt = report.oldBashAt || leanSh;

    const cmd = report.currentStatusline?.command || '';
    if (cmd.includes('lean-statusline')) report.leanAlreadyInstalled = true;
    return report;
}

// Detect whether the install command is being run through `npx`.
//
// Two signals, either sufficient:
//
//   1. Bin path — npm stages npx packages under ~/.npm/_npx/<hash>/...
//      When our own bin lives under that tree, we're fresh from npx.
//
//   2. npm env vars — npm 11.x sets `npm_lifecycle_event=npx` and
//      `npm_command=exec` when the invocation came from `npx`. Verified
//      empirically against npm 11.12.1; survives npx-delegation-to-global
//      (which otherwise makes the bin path look like a normal global
//      install and hides the fact that npx was the entry point).
//      npm_config_user_agent does NOT contain "npx/" despite some blog
//      posts claiming otherwise — don't rely on it.
export function isRunningViaNpx(binPath) {
    if (/[\\/](_npx|[.]npm[\\/]_npx)[\\/]/.test(binPath)) return true;
    if (process.env.npm_lifecycle_event === 'npx') return true;
    if (process.env.npm_command === 'exec' && process.env.npm_execpath) return true;
    return false;
}

// Pick the best `command` value for settings.json. Three modes:
//
//   "npx"    →  npx -y lean-statusline@latest
//              Self-updating. Adds ~100–300ms startup per render on
//              cache-warm, more on cache-cold. Best for users who never
//              want a global install.
//
//   "global" →  lean-statusline
//              Fastest. Requires `npm install -g lean-statusline` (or a
//              prior `npm link` during development).
//
//   "node"   →  node "<abs-path-to-bin>"
//              Direct invocation. Used from git clones.
//
// Selection order: explicit `mode` arg → npx-cache autodetect → PATH
// lookup → direct node.
export function pickCommand(binPath, mode) {
    if (mode === 'npx') return 'npx -y lean-statusline@latest';
    if (mode === 'global') return 'lean-statusline';
    if (mode === 'node') return `node "${binPath.replaceAll('\\', '/')}"`;

    // Auto-detect.
    if (isRunningViaNpx(binPath)) return 'npx -y lean-statusline@latest';
    if (findOnPath()) return 'lean-statusline';
    return `node "${binPath.replaceAll('\\', '/')}"`;
}

export function backupSettings() {
    const sp = settingsPath();
    if (!existsSync(sp)) return null;
    const bak = `${sp}.bak.${Math.floor(Date.now() / 1000)}`;
    copyFileSync(sp, bak);
    return bak;
}

export function patchSettings(command, { refreshInterval = 0, subagentCommand = null } = {}) {
    const sp = settingsPath();
    mkdirSync(claudeHome(), { recursive: true });
    let settings = {};
    if (existsSync(sp)) {
        try { settings = JSON.parse(readFileSync(sp, 'utf8')); } catch { /* start clean */ }
    }
    settings.statusLine = { type: 'command', command };
    if (refreshInterval > 0) settings.statusLine.refreshInterval = refreshInterval;
    if (subagentCommand) settings.subagentStatusLine = { type: 'command', command: subagentCommand };
    writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

export function unpatchSubagentSettings() {
    const sp = settingsPath();
    if (!existsSync(sp)) return false;
    let settings;
    try { settings = JSON.parse(readFileSync(sp, 'utf8')); } catch { return false; }
    if (!settings.subagentStatusLine) return false;
    delete settings.subagentStatusLine;
    writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    return true;
}

export function unpatchSettings() {
    const sp = settingsPath();
    if (!existsSync(sp)) return false;
    let settings;
    try { settings = JSON.parse(readFileSync(sp, 'utf8')); } catch { return false; }
    if (!settings.statusLine) return false;
    delete settings.statusLine;
    writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    return true;
}

// Run a dry render with a minimal stdin payload to confirm the binary works.
export async function smokeTest(binPath) {
    const r = spawnSync(process.execPath, [binPath], {
        input: JSON.stringify({
            model: { display_name: 'smoke' },
            context_window: { context_window_size: 200000, current_usage: { input_tokens: 0 } },
            cwd: process.cwd(),
        }),
        encoding: 'utf8',
        timeout: 3000,
    });
    return {
        ok: r.status === 0 && (r.stdout || '').length > 0,
        status: r.status,
        stdout: r.stdout,
        stderr: r.stderr,
    };
}
