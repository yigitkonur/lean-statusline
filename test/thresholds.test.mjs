import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { colorForPct } from '../lib/colors.mjs';
import { DEFAULTS, loadConfig, validateConfig } from '../lib/config.mjs';

const palette = {
    green: 'green',
    yellow: 'yellow',
    red: 'red',
    orange: 'orange',
};

function makeSandbox() {
    const root = mkdtempSync(join(tmpdir(), 'lean-thresholds-'));
    const homeDir = join(root, 'home');
    const projectDir = join(root, 'project');
    mkdirSync(join(homeDir, '.claude'), { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    return { root, homeDir, projectDir };
}

function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

test('thresholds: defaults use warn_at + critical_at', () => {
    assert.deepEqual(DEFAULTS.thresholds, {
        warn_at: 35,
        critical_at: 70,
    });
});

test('thresholds: colorForPct uses two-band config', () => {
    const thresholds = { warn_at: 70, critical_at: 90 };
    assert.equal(colorForPct(30, thresholds, palette), 'green');
    assert.equal(colorForPct(75, thresholds, palette), 'yellow');
    assert.equal(colorForPct(95, thresholds, palette), 'red');
});

test('thresholds: legacy high/crit aliases still map to yellow and red', () => {
    const legacy = { warn: 50, high: 70, crit: 90 };
    assert.equal(colorForPct(75, legacy, palette), 'yellow');
    assert.equal(colorForPct(95, legacy, palette), 'red');
});

test('thresholds: validateConfig rejects warn_at >= critical_at and accepts legacy aliases', () => {
    const invalid = validateConfig({
        ...DEFAULTS,
        thresholds: { warn_at: 95, critical_at: 90 },
    });
    assert.deepEqual(invalid, ['thresholds.warn_at must be < thresholds.critical_at']);

    const legacy = validateConfig({
        ...DEFAULTS,
        thresholds: { warn: 50, high: 70, crit: 90 },
    });
    assert.deepEqual(legacy, []);
});

test('thresholds: loadConfig normalizes legacy keys and surfaces deprecation warning', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        writeJson(join(projectDir, '.claude', 'lean-statusline.json'), {
            thresholds: { warn: 50, high: 72, crit: 91 },
        });

        const { config, warnings } = loadConfig({ workspace: { project_dir: projectDir } }, {
            env: {},
            homeDir,
            cwd: projectDir,
        });

        assert.deepEqual(config.thresholds, {
            warn_at: 72,
            critical_at: 91,
        });
        assert.deepEqual(warnings, [
            'thresholds.warn/high/crit are deprecated; use thresholds.warn_at/critical_at',
        ]);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
