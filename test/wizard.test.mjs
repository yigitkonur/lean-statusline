// End-to-end interactive tests for the wizard TUI and entry menu.
// Skipped on Windows per research note (ConPTY + node-pty flaky in CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, KEY } from './helpers/pty.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// PTY-driven TUI tests. The test harness works locally (verified against
// the real wizard rendering), but the waitFor-regex patterns are sensitive
// to terminal state + timing. Gating behind LEAN_RUN_PTY_TESTS=1 so CI and
// casual npm test runs don't spend 10+ seconds on these. Run locally with:
//     LEAN_RUN_PTY_TESTS=1 npm test
const skipPty = {
    skip: process.env.LEAN_RUN_PTY_TESTS === '1'
        ? (process.platform === 'win32' ? 'ConPTY flaky in CI' : false)
        : 'set LEAN_RUN_PTY_TESTS=1 to enable',
};

const skipOnWin = skipPty;

test('entry menu: arrow-down + enter launches the selected subcommand', skipOnWin, async () => {
    const home = mkdtempSync(join(tmpdir(), 'lean-menu-'));
    const app = launch([], { LEAN_STATUSLINE_CLAUDE_HOME: home });
    try {
        await app.waitFor(/configure and check/);
        await app.waitFor(/install.+patch settings\.json/);
        // Cursor starts on (1) install; down twice → config.
        await app.send([KEY.Down, KEY.Down]);
        // Spot-check: the cursor arrow is somewhere near "config".
        await app.waitFor(/❯.*config|config.*❯/);
        await app.send(KEY.Esc);
        const code = await app.waitExit();
        assert.equal(code, 0);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

test('entry menu: q quits immediately without running anything', skipOnWin, async () => {
    const home = mkdtempSync(join(tmpdir(), 'lean-menu-q-'));
    const app = launch([], { LEAN_STATUSLINE_CLAUDE_HOME: home });
    try {
        await app.waitFor(/configure and check/);
        await app.send('q');
        const code = await app.waitExit();
        assert.equal(code, 0);
        assert.doesNotMatch(app.plain, /patched settings\.json/);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

test('wizard: renders preset page, tab advances step indicator', skipOnWin, async () => {
    const home = mkdtempSync(join(tmpdir(), 'lean-wiz-'));
    const cfg = join(home, 'lean-statusline.json');
    const app = launch(['config'], {
        LEAN_STATUSLINE_CLAUDE_HOME: home,
        LEAN_STATUSLINE_CONFIG: cfg,
    });
    try {
        // Lands on step 1 / 5.
        await app.waitFor(/configure · step 1 \/ 5/);
        await app.waitFor(/preset/);
        // Tab → step 2.
        await app.send(KEY.Tab);
        await app.waitFor(/step 2 \/ 5/);
        // Quit without saving.
        await app.send('q');
        const code = await app.waitExit();
        assert.equal(code, 0);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

test('wizard: left/right cycles preset enum + preview reflects change', skipOnWin, async () => {
    const home = mkdtempSync(join(tmpdir(), 'lean-preset-'));
    const cfg = join(home, 'lean-statusline.json');
    const app = launch(['config'], {
        LEAN_STATUSLINE_CLAUDE_HOME: home,
        LEAN_STATUSLINE_CONFIG: cfg,
    });
    try {
        await app.waitFor(/step 1 \/ 5/);
        // default preset is compact; → cycles to full (wraps through list).
        await app.send(KEY.Right);
        // preview now contains the `context` line that only full renders.
        await app.waitFor(/context\s+[●─\-]/);
        await app.send('q');
        await app.waitExit();
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});
