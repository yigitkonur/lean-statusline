import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildSchema, initWizardState } from '../lib/wizard.mjs';

function makeSandbox() {
    const root = mkdtempSync(join(tmpdir(), 'lean-wizard-config-'));
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

test('wizard schema: rich segments include subagents', () => {
    const segmentIds = buildSchema()
        .filter(entry => entry.kind === 'segment')
        .map(entry => entry.id);
    assert.ok(segmentIds.includes('segment.subagents'), segmentIds.join(', '));
});

test('wizard init: uses the resolved project config path', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        const projectPath = join(projectDir, '.claude', 'lean-statusline.json');
        writeJson(projectPath, { separator: '/', segments: ['model', 'subagents'] });
        writeJson(join(homeDir, '.claude', 'lean-statusline.json'), { separator: '|' });

        const { path, state } = initWizardState({}, {
            env: {},
            homeDir,
            cwd: projectDir,
        });

        assert.equal(path, projectPath);
        assert.equal(state.separator, '/');
        assert.deepEqual(state.segments, ['model', 'subagents']);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
