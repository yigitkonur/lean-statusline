// Rate limit usage — prefer stdin payload, fall back to Anthropic API.
// OAuth token chain: env → macOS Keychain → credentials file → Linux secret-tool.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir, platform } from 'node:os';
import { join } from 'node:path';

const CACHE_PATH = join(tmpdir(), 'lean-statusline-usage.json');
const CACHE_TTL_MS = 60 * 1000;
// Keep this tight — a statusline render blocks the UI until this returns.
// 2s is enough for a warm network, and cache hit rate is high after the first render.
const FETCH_TIMEOUT_MS = 2000;

function readCache() {
    if (!existsSync(CACHE_PATH)) return null;
    try {
        const age = Date.now() - statSync(CACHE_PATH).mtimeMs;
        const data = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
        return { data, fresh: age < CACHE_TTL_MS };
    } catch { return null; }
}

function writeCache(data) {
    try {
        mkdirSync(tmpdir(), { recursive: true });
        writeFileSync(CACHE_PATH, JSON.stringify(data), 'utf8');
    } catch { /* ignore */ }
}

function fromEnv() {
    return process.env.CLAUDE_CODE_OAUTH_TOKEN || null;
}

function fromMacKeychain() {
    if (platform() !== 'darwin') return null;
    const r = spawnSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], {
        encoding: 'utf8', timeout: 2000,
    });
    if (r.status !== 0 || !r.stdout) return null;
    try {
        const parsed = JSON.parse(r.stdout.trim());
        return parsed.claudeAiOauth?.accessToken || null;
    } catch { return null; }
}

function fromCredentialsFile() {
    const p = join(homedir(), '.claude', '.credentials.json');
    if (!existsSync(p)) return null;
    try {
        const parsed = JSON.parse(readFileSync(p, 'utf8'));
        return parsed.claudeAiOauth?.accessToken || null;
    } catch { return null; }
}

function fromLinuxSecretTool() {
    if (platform() !== 'linux') return null;
    const r = spawnSync('secret-tool', ['lookup', 'service', 'Claude Code-credentials'], {
        encoding: 'utf8', timeout: 2000,
    });
    if (r.status !== 0 || !r.stdout) return null;
    try {
        const parsed = JSON.parse(r.stdout.trim());
        return parsed.claudeAiOauth?.accessToken || null;
    } catch { return null; }
}

export function resolveOAuthToken() {
    return fromEnv() || fromMacKeychain() || fromCredentialsFile() || fromLinuxSecretTool();
}

async function fetchUsage(token) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${token}`,
                'anthropic-beta': 'oauth-2025-04-20',
                'user-agent': 'lean-statusline',
            },
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.five_hour) return null;
        return data;
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

// Returns { five_hour_pct, seven_day_pct } or partial/null.
// Source priority: stdin payload → fresh cache → fresh API call → stale cache.
export async function getRateLimits(input) {
    // 1. From stdin (newer Claude Code builds send these).
    const sp = input?.rate_limits?.five_hour?.used_percentage;
    if (sp != null) {
        return {
            fiveHourPct: Math.round(sp),
            sevenDayPct: input.rate_limits.seven_day?.used_percentage != null
                ? Math.round(input.rate_limits.seven_day.used_percentage)
                : null,
            source: 'stdin',
        };
    }

    // 2. Cache.
    const cached = readCache();
    if (cached?.fresh) {
        return packLimits(cached.data, 'cache');
    }

    // 3. API, if token resolvable.
    const token = resolveOAuthToken();
    if (token) {
        const data = await fetchUsage(token);
        if (data) {
            writeCache(data);
            return packLimits(data, 'api');
        }
    }

    // 4. Stale cache as last resort.
    if (cached) return packLimits(cached.data, 'stale-cache');

    return { fiveHourPct: null, sevenDayPct: null, source: 'none' };
}

function packLimits(data, source) {
    return {
        fiveHourPct: data.five_hour?.utilization != null ? Math.round(data.five_hour.utilization) : null,
        sevenDayPct: data.seven_day?.utilization != null ? Math.round(data.seven_day.utilization) : null,
        source,
    };
}
