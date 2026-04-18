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

// Pick the best `command` value for settings.json.
// Priority: lean-statusline on PATH (global install) > explicit node invocation.
export function pickCommand(binPath) {
    const onPath = findOnPath();
    if (onPath) return 'lean-statusline';
    // Fallback: invoke this package's bin directly.
    // Windows needs forward slashes in JSON / the shell respects them for node.
    const p = binPath.replaceAll('\\', '/');
    return `node "${p}"`;
}

export function backupSettings() {
    const sp = settingsPath();
    if (!existsSync(sp)) return null;
    const bak = `${sp}.bak.${Math.floor(Date.now() / 1000)}`;
    copyFileSync(sp, bak);
    return bak;
}

export function patchSettings(command) {
    const sp = settingsPath();
    mkdirSync(claudeHome(), { recursive: true });
    let settings = {};
    if (existsSync(sp)) {
        try { settings = JSON.parse(readFileSync(sp, 'utf8')); } catch { /* start clean */ }
    }
    settings.statusLine = { type: 'command', command };
    writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
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
