import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, closeSync, ftruncateSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PRESETS } from '../lib/presets.mjs';
import { loadState } from '../lib/state.mjs';
import { emptyTranscriptState, reduceTranscript } from '../lib/transcript.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function makeSandbox() {
    const root = mkdtempSync(join(tmpdir(), 'lean-transcript-'));
    return {
        root,
        transcriptPath: join(root, 'session.jsonl'),
        stateDir: join(root, 'state'),
        configPath: join(root, 'config.json'),
    };
}

function writeLines(path, lines) {
    writeFileSync(path, lines.join('\n') + '\n', 'utf8');
}

function appendLines(path, lines) {
    appendFileSync(path, lines.join('\n') + '\n', 'utf8');
}

function line(entry) {
    return JSON.stringify(entry);
}

function renderWithTranscript(sessionId, transcriptPath, stateDir, configPath) {
    return spawnSync(process.execPath, [BIN], {
        input: JSON.stringify({
            session_id: sessionId,
            transcript_path: transcriptPath,
            model: { display_name: 'Opus 4.7' },
            context_window: { context_window_size: 1000000, used_percentage: 12 },
        }),
        env: {
            ...process.env,
            LEAN_STATUSLINE_CONFIG: configPath,
            LEAN_STATUSLINE_STATE_DIR: stateDir,
        },
        encoding: 'utf8',
        timeout: 5000,
    });
}

test('transcript defaults: full preset enables transcript reduction', () => {
    assert.equal(PRESETS.full.config.transcript?.enabled, true);
    assert.equal(PRESETS.compact.config.transcript?.enabled ?? false, false);
    assert.equal(PRESETS.minimal.config.transcript?.enabled ?? false, false);
});

test('transcript reducer: oversized sparse files do not trigger unbounded allocations', async () => {
    const { root, transcriptPath } = makeSandbox();
    try {
        const fd = openSync(transcriptPath, 'w');
        ftruncateSync(fd, 3 * 1024 * 1024 * 1024);
        closeSync(fd);

        const reduced = await reduceTranscript(transcriptPath, 0, null, 1);
        assert.equal(reduced.offset, 0);
        assert.deepEqual(reduced.state, emptyTranscriptState());
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('transcript reducer: unreadable files fail closed without throwing', {
    skip: process.platform === 'win32' ? 'POSIX permissions required' : false,
}, async () => {
    const { root, transcriptPath } = makeSandbox();
    try {
        writeLines(transcriptPath, [line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'task-1', name: 'Task' }] } })]);
        chmodSync(transcriptPath, 0o000);
        const reduced = await reduceTranscript(transcriptPath, 0, null, 50);
        assert.equal(reduced.offset, 0);
        assert.deepEqual(reduced.state, emptyTranscriptState());
    } finally {
        try { chmodSync(transcriptPath, 0o600); } catch {}
        rmSync(root, { recursive: true, force: true });
    }
});

test('transcript reducer: fresh read, append-only resume, malformed lines, and rotation all work', async () => {
    const { root, transcriptPath } = makeSandbox();
    try {
        writeLines(transcriptPath, [
            line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'edit-1', name: 'Edit' }] } }),
            line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'edit-1', is_error: false }] } }),
            line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'task-1', name: 'Task', input: { subagent_type: 'research' } }] } }),
            line({ type: 'assistant', message: { usage: { input_tokens: 100, cache_read_input_tokens: 20, cache_creation: { ephemeral_5m_input_tokens: 10, ephemeral_1h_input_tokens: 5 } } } }),
        ]);

        const first = await reduceTranscript(transcriptPath, 0, null, 500);
        assert.equal(first.state.lastTool, 'Task');
        assert.equal(first.state.lastToolOk, true);
        assert.equal(first.state.failStreak, 0);
        assert.deepEqual(Object.keys(first.state.subagents), ['task-1']);
        assert.deepEqual(first.state.cacheStats, {
            input: 100,
            cacheRead: 20,
            cacheCreation: 15,
        });

        const unchanged = await reduceTranscript(transcriptPath, first.offset, first.state, 500);
        assert.equal(unchanged.offset, first.offset);
        assert.deepEqual(unchanged.state, first.state);

        appendLines(transcriptPath, [
            '{bad json',
            line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'task-1', is_error: true }] } }),
            line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'task-2', name: 'Task', input: { subagent_type: 'review' } }] } }),
        ]);

        const appended = await reduceTranscript(transcriptPath, first.offset, first.state, 500);
        assert.equal(appended.state.lastTool, 'Task');
        assert.equal(appended.state.lastToolOk, false);
        assert.equal(appended.state.failStreak, 1);
        assert.deepEqual(Object.keys(appended.state.subagents), ['task-2']);
        assert.ok(appended.offset > first.offset);

        writeLines(transcriptPath, [
            line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'task-3', name: 'Task', input: { subagent_type: 'test' } }] } }),
        ]);

        const rotated = await reduceTranscript(transcriptPath, appended.offset, appended.state, 500);
        assert.deepEqual(Object.keys(rotated.state.subagents), ['task-3']);
        assert.equal(rotated.state.failStreak, 0);
        assert.equal(rotated.state.lastTool, 'Task');
        assert.ok(rotated.offset < appended.offset);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('transcript integration: render persists reducer offset and resumes from prior state', () => {
    const { root, transcriptPath, stateDir, configPath } = makeSandbox();
    try {
        writeFileSync(configPath, JSON.stringify({
            preset: 'minimal',
            segments: ['model'],
            show: { branch: false, dirty: false, zap: false, bars: false },
            icons: 'ascii',
            colors: false,
            separator: '·',
            contextBarWidth: 75,
            thresholds: { warn_at: 70, critical_at: 90 },
            transcript: { enabled: true, maxFirstReadMs: 500 },
        }, null, 2));

        writeLines(transcriptPath, [
            line({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'task-a', name: 'Task', input: { subagent_type: 'research' } }] } }),
        ]);

        const first = renderWithTranscript('demo-session', transcriptPath, stateDir, configPath);
        assert.equal(first.status, 0, first.stderr);
        let saved = loadState('demo-session', { dir: stateDir });
        assert.ok(saved.lastSeen.transcript.offset > 0);
        assert.deepEqual(Object.keys(saved.lastSeen.transcript.state.subagents), ['task-a']);

        appendLines(transcriptPath, [
            line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'task-a', is_error: false }] } }),
        ]);

        const second = renderWithTranscript('demo-session', transcriptPath, stateDir, configPath);
        assert.equal(second.status, 0, second.stderr);
        const resumed = loadState('demo-session', { dir: stateDir });
        assert.ok(resumed.lastSeen.transcript.offset > saved.lastSeen.transcript.offset);
        assert.deepEqual(Object.keys(resumed.lastSeen.transcript.state.subagents), []);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
