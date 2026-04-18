// Git state. Fast, no-optional-locks, fails silently outside a work tree.
import { spawnSync } from 'node:child_process';

function runGit(cwd, args, timeoutMs = 500) {
    const r = spawnSync('git', ['-C', cwd, ...args], {
        encoding: 'utf8',
        timeout: timeoutMs,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (r.status !== 0 || r.error) return null;
    return r.stdout.trim();
}

export function gitState(cwd) {
    const inWt = runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
    if (inWt !== 'true') return { branch: null, dirty: false };
    const branch = runGit(cwd, ['symbolic-ref', '--short', 'HEAD']) || null;
    const status = runGit(cwd, ['--no-optional-locks', 'status', '--porcelain']);
    return { branch, dirty: !!(status && status.length > 0) };
}
