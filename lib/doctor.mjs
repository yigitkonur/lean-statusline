// `lean-statusline doctor` — checks the install is healthy.
import { existsSync, readFileSync } from 'node:fs';
import { claudeHome, settingsPath, detectExisting, findOnPath, smokeTest } from './install.mjs';
import { loadConfig, validateConfig, CONFIG_PATH } from './config.mjs';
import { cleanStateFiles, listStateFiles } from './state.mjs';
import { resolveOAuthToken } from './usage.mjs';

const OK = '✓';
const FAIL = '✗';
const WARN = '!';

function line(mark, label, detail) {
    const marker = mark === 'ok' ? OK : mark === 'fail' ? FAIL : WARN;
    const color = mark === 'ok' ? '\x1b[32m' : mark === 'fail' ? '\x1b[31m' : '\x1b[33m';
    return `${color}${marker}\x1b[0m  ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`;
}

export async function runDoctor(binPath, options = {}) {
    const out = [];
    let fails = 0, warns = 0;

    // node version
    const major = parseInt(process.versions.node.split('.')[0], 10);
    if (major >= 20) out.push(line('ok', 'node ≥ 20', `running ${process.versions.node}`));
    else { out.push(line('fail', 'node >= 20 required', `running ${process.versions.node}`)); fails++; }

    // claude home + settings
    const ch = claudeHome();
    if (existsSync(ch)) out.push(line('ok', `claude home exists`, ch));
    else { out.push(line('fail', `claude home missing`, ch)); fails++; }

    const sp = settingsPath();
    if (existsSync(sp)) out.push(line('ok', `settings.json exists`, sp));
    else { out.push(line('warn', `settings.json missing`, 'run install to create it')); warns++; }

    // statusLine patched?
    const det = detectExisting();
    if (det.leanAlreadyInstalled) {
        out.push(line('ok', `settings.json#statusLine wired to lean-statusline`, det.currentStatusline.command));
    } else if (det.currentStatusline) {
        out.push(line('warn', `settings.json#statusLine points elsewhere`, det.currentStatusline.command));
        warns++;
    } else {
        out.push(line('warn', `settings.json#statusLine not set`, 'run install'));
        warns++;
    }

    // PATH lookup
    const onPath = findOnPath();
    if (onPath) out.push(line('ok', `lean-statusline on PATH`, onPath));
    else out.push(line('warn', `lean-statusline not on PATH`, 'using explicit node invocation (ok)'));

    // config file
    const { config, path, warning, source, candidates } = loadConfig();
    if (existsSync(path)) {
        if (warning) { out.push(line('fail', `config file invalid`, warning)); fails++; }
        else out.push(line('ok', `config file valid`, path));
        const errs = validateConfig(config);
        if (errs.length) { out.push(line('fail', `config schema errors`, errs.join('; '))); fails++; }
    } else {
        out.push(line('ok', `using built-in defaults`, `no ${CONFIG_PATH} — that's fine`));
    }
    out.push(line('ok', 'config resolution', `${source}: ${candidates.join(' → ')}`));

    // OAuth token (optional — only needed for rate-limit fallback)
    const token = resolveOAuthToken();
    if (token) out.push(line('ok', `OAuth token resolvable`, 'rate-limit fallback available'));
    else out.push(line('warn', `OAuth token not found`, 'rate limits only via stdin; 5h/7d may be hidden on old CC'));

    // old bash / ccline leftovers
    if (det.oldBashAt) {
        out.push(line('warn', `old bash statusline present`, `${det.oldBashAt} — consider removing`));
        warns++;
    }
    if (det.ccline) {
        out.push(line('warn', `ccline binary present`, `${det.ccline} — not used by lean-statusline`));
        warns++;
    }

    const stateFiles = listStateFiles();
    if (options.clean) {
        const removed = cleanStateFiles();
        out.push(line('ok', 'session state files cleaned', `${removed} removed`));
    } else if (stateFiles.length) {
        const stale = stateFiles.filter(file => file.stale);
        if (stale.length) {
            out.push(line('warn', 'stale session state files present', `${stale.length} stale, ${stateFiles.length} total`));
            warns++;
        } else {
            out.push(line('ok', 'session state files', `${stateFiles.length} present`));
        }
    } else {
        out.push(line('ok', 'session state files', 'none'));
    }

    // smoke test
    const s = await smokeTest(binPath);
    if (s.ok) out.push(line('ok', `smoke test passed`, `${s.stdout.trim().slice(0, 80)}${s.stdout.length > 80 ? '…' : ''}`));
    else { out.push(line('fail', `smoke test failed`, s.stderr || `status ${s.status}`)); fails++; }

    out.push('');
    out.push(`${fails === 0 ? '\x1b[32mall good\x1b[0m' : `\x1b[31m${fails} failure(s)\x1b[0m`}` + (warns ? `, \x1b[33m${warns} warning(s)\x1b[0m` : ''));
    return { report: out.join('\n'), fails, warns };
}
