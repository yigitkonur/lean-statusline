import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DEFAULTS } from '../lib/config.mjs';
import { applyPreset } from '../lib/presets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function render(input, cfg) {
    const tmp = mkdtempSync(join(tmpdir(), 'lean-agent-'));
    const cfgPath = join(tmp, 'c.json');
    writeFileSync(cfgPath, JSON.stringify(cfg));
    const result = spawnSync(process.execPath, [BIN], {
        input: JSON.stringify(input),
        env: { ...process.env, LEAN_STATUSLINE_CONFIG: cfgPath },
        encoding: 'utf8',
        timeout: 5000,
    });
    rmSync(tmp, { recursive: true, force: true });
    return result;
}

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\]\d+;[^\x07]*?\x07/g, '');
const fullCfg = applyPreset(structuredClone(DEFAULTS), 'full');
const baseInput = {
    model: { display_name: 'Opus 4.7' },
    cwd: '/tmp/project',
    context_window: { context_window_size: 1000000, used_percentage: 12 },
    cost: { total_duration_ms: 1000 },
};

test('agent preset defaults: full preset hides default and claude agent names', () => {
    for (const name of ['default', 'claude']) {
        const result = render({ ...baseInput, agent: { name } }, fullCfg);
        assert.equal(result.status, 0, result.stderr);
        assert.doesNotMatch(stripAnsi(result.stdout), new RegExp(name));
    }
});

test('agent preset defaults: full preset still shows custom agent names', () => {
    const result = render({ ...baseInput, agent: { name: 'security-reviewer' } }, fullCfg);
    assert.equal(result.status, 0, result.stderr);
    assert.match(stripAnsi(result.stdout), /security-reviewer/);
});
