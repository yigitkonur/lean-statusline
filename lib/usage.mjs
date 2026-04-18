// Rate limit usage — prefer stdin payload, fall back to Anthropic API.
// OAuth token chain: env → macOS Keychain → credentials file → Linux secret-tool.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir, platform } from 'node:os';
import { join } from 'node:path';

const LEGACY_CACHE_PATH = join(tmpdir(), 'lean-statusline-usage.json');
const CACHE_TTL_MS = 60 * 1000;

// Per-session cache path. Docs explicitly recommend keying off session_id so
// concurrent Claude Code instances don't fight over a shared file. Fall back
// to the legacy shared path when session_id is absent (older CC builds).
function cachePath(sessionId) {
    if (!sessionId) return LEGACY_CACHE_PATH;
    // Sanitize — session_id is trusted input from Claude Code, but belt-and-braces.
    const safe = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
    return join(tmpdir(), `lean-statusline-usage-${safe}.json`);
}
// Keep this tight — a statusline render blocks the UI until this returns.
// 2s is enough for a warm network, and cache hit rate is high after the first render.
const FETCH_TIMEOUT_MS = 2000;

function readCache(path) {
    if (!existsSync(path)) return null;
    try {
        const age = Date.now() - statSync(path).mtimeMs;
        const data = JSON.parse(readFileSync(path, 'utf8'));
        return { data, fresh: age < CACHE_TTL_MS };
    } catch { return null; }
}

function writeCache(path, data) {
    try {
        mkdirSync(tmpdir(), { recursive: true });
        writeFileSync(path, JSON.stringify(data), 'utf8');
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

// Returns { fiveHour: { pct, resetsAt }, sevenDay: { pct, resetsAt }, source }.
// Source priority: stdin payload → fresh cache → fresh API call → stale cache.
export async function getRateLimits(input) {
    const sessionId = input?.session_id;
    const path = cachePath(sessionId);

    // 1. From stdin (newer Claude Code builds send these).
    const spPct = input?.rate_limits?.five_hour?.used_percentage;
    if (spPct != null) {
        return {
            fiveHour: {
                pct: Math.round(spPct),
                resetsAt: parseResetsAt(input.rate_limits.five_hour?.resets_at),
            },
            sevenDay: input.rate_limits.seven_day?.used_percentage != null ? {
                pct: Math.round(input.rate_limits.seven_day.used_percentage),
                resetsAt: parseResetsAt(input.rate_limits.seven_day?.resets_at),
            } : null,
            source: 'stdin',
        };
    }

    // 2. Cache.
    const cached = readCache(path);
    if (cached?.fresh) return packLimits(cached.data, 'cache');

    // 3. API, if token resolvable.
    const token = resolveOAuthToken();
    if (token) {
        const data = await fetchUsage(token);
        if (data) {
            writeCache(path, data);
            return packLimits(data, 'api');
        }
    }

    // 4. Stale cache as last resort.
    if (cached) return packLimits(cached.data, 'stale-cache');

    return { fiveHour: null, sevenDay: null, source: 'none' };
}

// Handle every shape Claude Code has ever sent:
//   - Unix seconds   (spec: `rate_limits.*.resets_at` is epoch seconds, ~1.7e9)
//   - Unix ms        (older unofficial builds, ~1.7e12)
//   - ISO 8601 string (API fallback response from api.anthropic.com)
// Returns milliseconds since epoch, or null for unparseable input.
export function parseResetsAt(v) {
    if (v == null) return null;
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) return null;
        return v < 1e12 ? v * 1000 : v;   // 1e12 ms ≈ year 33658 in sec vs 2001 in ms
    }
    if (typeof v === 'string') {
        const n = Date.parse(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function packLimits(data, source) {
    const pack = (obj) => obj ? {
        pct: obj.utilization != null ? Math.round(obj.utilization) : null,
        resetsAt: parseResetsAt(obj.resets_at),
    } : null;
    return {
        fiveHour: pack(data.five_hour),
        sevenDay: pack(data.seven_day),
        source,
    };
}
