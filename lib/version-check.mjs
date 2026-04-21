// Background version checks. Reads cache files synchronously (zero latency),
// triggers detached background fetches when stale. Never blocks the render path.
//
// Two parallel flows:
//   - CC version (Anthropic's own claude-code package): the user-visible
//     "update avail X.Y.Z" inline notice on context-bar.
//   - lean-statusline self-version: opt-out auto-install. When a newer
//     version is available on npm, a detached `npm install -g
//     lean-statusline@latest` runs in the background (throttled to
//     once per 24h via a lock file). Next render picks up the new code.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

const CACHE_DIR   = join(homedir(), '.claude', 'lean-statusline');
const CACHE_FILE  = join(CACHE_DIR, 'cc-version.json');
const LEAN_CACHE_FILE = join(CACHE_DIR, 'lean-version.json');
const AUTO_LOCK_FILE  = join(CACHE_DIR, 'auto-install.lock');
const CC_PACKAGE   = '@anthropic-ai/claude-code';
const LEAN_PACKAGE = 'lean-statusline';
const TTL_MS          = 60 * 60 * 1000;        // 1 hour  — version poll cadence
const AUTO_LOCK_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours — auto-install cadence

function readCache() {
    try { return JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch { return null; }
}

// Stamp `checkedAt: now` into the cache *before* spawning the background fetch.
// Without this, a fetch that fails silently (offline, registry unreachable)
// leaves the cache stale and we respawn a detached process on every render.
// With this, we respect TTL whether or not the fetch succeeds — retries are
// throttled to one per TTL window regardless of outcome.
function markAttempted(prevCache) {
    try {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(CACHE_FILE, JSON.stringify({
            checkedAt: Date.now(),
            latest: prevCache?.latest ?? null,
        }));
    } catch { /* silent — cache is best-effort */ }
}

function spawnFetch() {
    // CJS script — safe in a detached child_process.spawn even from an ESM parent.
    const script = [
        `var https=require('https'),fs=require('fs'),path=require('path');`,
        `var dir=${JSON.stringify(CACHE_DIR)};`,
        `var req=https.request({hostname:'registry.npmjs.org',path:${JSON.stringify(`/${CC_PACKAGE}/latest`)},method:'GET',timeout:8000},function(res){`,
        `  var d='';res.setEncoding('utf8');res.on('data',function(c){d+=c;});`,
        `  res.on('end',function(){`,
        `    try{var v=JSON.parse(d).version;if(!v)return;`,
        `    fs.mkdirSync(dir,{recursive:true});`,
        `    var tmp=path.join(dir,'cc-version.tmp');`,
        `    fs.writeFileSync(tmp,JSON.stringify({checkedAt:Date.now(),latest:v}));`,
        `    fs.renameSync(tmp,${JSON.stringify(CACHE_FILE)});`,
        `    }catch(e){}`,
        `  });`,
        `});`,
        `req.on('error',function(){});req.on('timeout',function(){req.destroy();});req.end();`,
    ].join('');
    try {
        spawn(process.execPath, ['-e', script], { detached: true, stdio: 'ignore' }).unref();
    } catch { /* network unreachable — silent */ }
}

// Compares two semver strings (x.y.z). Returns true if a > b.
export function semverGt(a, b) {
    if (!a || !b) return false;
    const pa = String(a).replace(/[-+].*$/, '').split('.').map(Number);
    const pb = String(b).replace(/[-+].*$/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
        if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
    }
    return false;
}

// Returns the latest available CC version string when newer than currentVersion,
// or null when up-to-date / unknown / network disabled.
// Triggers a background refresh when cache is stale; never awaits it.
export function checkCcUpdate(currentVersion) {
    if (process.env.LEAN_STATUSLINE_NO_NETWORK === '1') return null;
    const cache = readCache();
    if (!cache || Date.now() - (cache.checkedAt ?? 0) > TTL_MS) {
        markAttempted(cache);
        spawnFetch();
    }
    if (!cache?.latest) return null;
    return semverGt(cache.latest, currentVersion) ? cache.latest : null;
}

// ── Self-version check (parallel flow for lean-statusline itself) ──

function readLeanCache() {
    try { return JSON.parse(readFileSync(LEAN_CACHE_FILE, 'utf8')); } catch { return null; }
}

function markLeanAttempted(prevCache) {
    try {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(LEAN_CACHE_FILE, JSON.stringify({
            checkedAt: Date.now(),
            latest: prevCache?.latest ?? null,
        }));
    } catch { /* silent */ }
}

function spawnLeanFetch() {
    const script = [
        `var https=require('https'),fs=require('fs'),path=require('path');`,
        `var dir=${JSON.stringify(CACHE_DIR)};`,
        `var req=https.request({hostname:'registry.npmjs.org',path:${JSON.stringify(`/${LEAN_PACKAGE}/latest`)},method:'GET',timeout:8000,headers:{'user-agent':'lean-statusline'}},function(res){`,
        `  var d='';res.setEncoding('utf8');res.on('data',function(c){d+=c;});`,
        `  res.on('end',function(){`,
        `    try{var v=JSON.parse(d).version;if(!v)return;`,
        `    fs.mkdirSync(dir,{recursive:true});`,
        `    var tmp=path.join(dir,'lean-version.tmp');`,
        `    fs.writeFileSync(tmp,JSON.stringify({checkedAt:Date.now(),latest:v}));`,
        `    fs.renameSync(tmp,${JSON.stringify(LEAN_CACHE_FILE)});`,
        `    }catch(e){}`,
        `  });`,
        `});`,
        `req.on('error',function(){});req.on('timeout',function(){req.destroy();});req.end();`,
    ].join('');
    try {
        spawn(process.execPath, ['-e', script], { detached: true, stdio: 'ignore' }).unref();
    } catch { /* silent */ }
}

// Latest published lean-statusline when newer than `currentVersion`, else null.
// Same cache/throttle model as checkCcUpdate.
export function checkLeanUpdate(currentVersion) {
    if (process.env.LEAN_STATUSLINE_NO_NETWORK === '1') return null;
    const cache = readLeanCache();
    if (!cache || Date.now() - (cache.checkedAt ?? 0) > TTL_MS) {
        markLeanAttempted(cache);
        spawnLeanFetch();
    }
    if (!cache?.latest) return null;
    return semverGt(cache.latest, currentVersion) ? cache.latest : null;
}

// Detach `npm install -g lean-statusline@<version>` in the background and
// return immediately. Never blocks the render. Silent best-effort — if the
// user installed via sudo, or lacks write access to the global prefix, or
// doesn't have npm on PATH, the spawn fails silently and nothing changes.
//
// Throttled to once per 24 hours via AUTO_LOCK_FILE: we don't want a broken
// install to retry on every render, and version checks are themselves
// already capped to once per hour. The lock file records the last attempt
// so subsequent renders within 24h skip the spawn regardless of outcome.
//
// Opt out via `LEAN_STATUSLINE_NO_AUTOUPDATE=1` (finer-grained than
// LEAN_STATUSLINE_NO_NETWORK, which also silences the update notice).
export function spawnAutoInstall(version) {
    if (process.env.LEAN_STATUSLINE_NO_AUTOUPDATE === '1') return false;
    if (process.env.LEAN_STATUSLINE_NO_NETWORK === '1') return false;
    if (!version) return false;
    try {
        if (existsSync(AUTO_LOCK_FILE)) {
            const age = Date.now() - statSync(AUTO_LOCK_FILE).mtimeMs;
            if (age < AUTO_LOCK_TTL_MS) return false;
        }
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(AUTO_LOCK_FILE, JSON.stringify({ startedAt: Date.now(), version }));
        spawn('npm', ['install', '-g', `${LEAN_PACKAGE}@${version}`], {
            detached: true,
            stdio: 'ignore',
            shell: process.platform === 'win32',
        }).unref();
        return true;
    } catch { return false; }
}
