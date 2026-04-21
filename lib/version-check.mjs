// Background CC version check. Reads a cache file synchronously (zero latency),
// triggers a detached background fetch when the cache is > 1 hour old.
// Never blocks the render path.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

const CACHE_DIR   = join(homedir(), '.claude', 'lean-statusline');
const CACHE_FILE  = join(CACHE_DIR, 'cc-version.json');
const CC_PACKAGE  = '@anthropic-ai/claude-code';
const TTL_MS      = 60 * 60 * 1000; // 1 hour

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
