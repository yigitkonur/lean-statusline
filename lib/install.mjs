// install/uninstall/doctor logic.
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Shared remediation copy for `npm install -g` permission failures.
// Used both by `selfupdate` and by `install` when ensureGlobalInstall fails.
export const NPM_EACCES_HINT = [
    '  on macOS with homebrew-managed node, the global prefix is writable without sudo.',
    '  if you see EACCES, either re-run with sudo or follow the npm docs on fixing permissions:',
    '    https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally',
].join('\n');

export function claudeHome() {
    return process.env.LEAN_STATUSLINE_CLAUDE_HOME || join(homedir(), '.claude');
}

export function settingsPath() {
    return join(claudeHome(), 'settings.json');
}

// Find the `lean-statusline` binary on PATH. Returns absolute path or null.
export function findOnPath(binName = 'lean-statusline') {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(which, [binName], { encoding: 'utf8' });
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
//
// @deprecated since 1.6.0 — auto-npx detection removed from pickCommand;
//   `install` now always tries `npm install -g` first and the npx form is
//   only selected via explicit `--via npx`. Kept for one release in case
//   downstream consumers depend on it; safe to delete in 1.7.0.
export function isRunningViaNpx(binPath) {
    if (/[\\/](_npx|[.]npm[\\/]_npx)[\\/]/.test(binPath)) return true;
    if (process.env.npm_lifecycle_event === 'npx') return true;
    if (process.env.npm_command === 'exec' && process.env.npm_execpath) return true;
    return false;
}

// Pick the best `command` value for settings.json. Three modes:
//
//   "npx"    →  npx -y lean-statusline@latest
//              Self-updating. Spawns npm on every render — ~9× more CPU
//              than the global bin (measured 2.31s vs 0.26s on darwin
//              with cache cold). Explicit opt-in only.
//
//   "global" →  lean-statusline
//              Fastest. Requires `npm install -g lean-statusline` — done
//              automatically by `install` unless --via npx|node is passed.
//
//   "node"   →  node "<abs-path-to-bin>"
//              Direct invocation. Used from git clones.
//
// Selection order: explicit `mode` arg → PATH lookup → direct node.
// npx is never auto-selected.
export function pickCommand(binPath, mode) {
    if (mode === 'npx') return 'npx -y lean-statusline@latest';
    if (mode === 'global') return 'lean-statusline';
    if (mode === 'node') return `node "${binPath.replaceAll('\\', '/')}"`;
    if (findOnPath()) return 'lean-statusline';
    return `node "${binPath.replaceAll('\\', '/')}"`;
}

// Same runtime-mode selection as pickCommand, but for the subagent bin. npx
// mode reuses the main package since both bins ship in a single npm package.
export function pickSubagentCommand(binPath, mode) {
    if (mode === 'npx') return 'npx -y -p lean-statusline@latest lean-statusline-subagents';
    if (mode === 'global') return 'lean-statusline-subagents';
    if (mode === 'node') return `node "${binPath.replaceAll('\\', '/')}"`;
    if (findOnPath('lean-statusline-subagents')) return 'lean-statusline-subagents';
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

// Update statusLine.refreshInterval without rewriting the command. Used by
// preset-switch flows — the main command stays whatever the user installed,
// only the interval changes.
export function syncSettingsRefreshInterval(refreshInterval) {
    const sp = settingsPath();
    if (!existsSync(sp)) return false;
    let settings;
    try { settings = JSON.parse(readFileSync(sp, 'utf8')); } catch { return false; }
    if (!settings.statusLine?.command) return false;
    if (Number.isFinite(refreshInterval) && refreshInterval > 0) {
        settings.statusLine.refreshInterval = refreshInterval;
    } else {
        delete settings.statusLine.refreshInterval;
    }
    writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    return true;
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

// Make `lean-statusline` available as a globally-installed npm bin.
//
// Behavior, in order:
//   1. Verify `npm` is on PATH (else throw NPM_NOT_FOUND).
//   2. If skipIfPresent and `lean-statusline` already resolves on PATH → return
//      `{ action: 'already-present' }` without running `npm install -g`. This
//      makes the helper idempotent so `install` can be re-run cheaply.
//   3. Otherwise run `npm install -g lean-statusline@<version>`. Non-zero
//      status → throw NPM_INSTALL_FAILED with stderr attached.
//   4. Re-check PATH. If the bin still isn't found, the npm prefix bin dir
//      isn't on PATH (common after a fresh nvm/fnm/Volta install) → throw
//      BIN_NOT_ON_PATH with the prefix dir attached so the caller can print
//      a copy-pasteable PATH-fix line.
//
// `spawn` is injectable so tests can stub `child_process.spawnSync` without
// monkey-patching the module.
export async function ensureGlobalInstall({
    version = 'latest',
    skipIfPresent = true,
    spawn = spawnSync,
    log = () => {},
} = {}) {
    const isWin = process.platform === 'win32';
    const which = isWin ? 'where' : 'which';
    const onPath = (binName = 'lean-statusline') => {
        const r = spawn(which, [binName], { encoding: 'utf8' });
        if (!r || r.status !== 0) return null;
        return (r.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || null;
    };

    // 1. npm available?
    const ver = spawn('npm', ['--version'], { encoding: 'utf8', shell: isWin });
    if (!ver || ver.error?.code === 'ENOENT' || ver.status !== 0) {
        const err = new Error('npm not found on PATH');
        err.code = 'NPM_NOT_FOUND';
        throw err;
    }
    log(`npm ${ver.stdout?.trim() || '?'} available`);

    // 2. already installed?
    if (skipIfPresent) {
        const found = onPath();
        if (found) {
            log(`lean-statusline already on PATH → ${found}`);
            return { ok: true, action: 'already-present', binPath: found, version: null };
        }
    }

    // 3. install.
    log(`running: npm install -g lean-statusline@${version}`);
    const inst = spawn('npm', ['install', '-g', `lean-statusline@${version}`], {
        encoding: 'utf8',
        stdio: 'inherit',
        shell: isWin,
    });
    if (!inst || inst.status !== 0) {
        const err = new Error(`npm install -g lean-statusline@${version} failed`);
        err.code = 'NPM_INSTALL_FAILED';
        err.status = inst?.status ?? null;
        err.stderr = inst?.stderr ?? '';
        err.stdout = inst?.stdout ?? '';
        throw err;
    }

    // 4. visible on PATH?
    const found = onPath();
    if (!found) {
        const prefix = spawn('npm', ['prefix', '-g'], { encoding: 'utf8', shell: isWin });
        const prefixDir = (prefix?.stdout || '').trim();
        const npmPrefixBin = prefixDir
            ? (isWin ? prefixDir : `${prefixDir}/bin`)
            : null;
        const err = new Error('lean-statusline installed but not visible on PATH');
        err.code = 'BIN_NOT_ON_PATH';
        err.npmPrefixBin = npmPrefixBin;
        throw err;
    }

    const action = skipIfPresent ? 'installed' : 'reinstalled';
    log(`${action} → ${found}`);
    return { ok: true, action, binPath: found, version };
}
