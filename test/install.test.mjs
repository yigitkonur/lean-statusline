import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCommand, pickSubagentCommand, ensureGlobalInstall } from '../lib/install.mjs';

// Stub builder for ensureGlobalInstall's injected `spawn`. Returns the stub
// plus a `calls` array tracking every (cmd, args) pair so each test can
// assert exactly which subprocesses ran.
function makeSpawnStub(handlers) {
    const calls = [];
    const fn = (cmd, args = [], opts = {}) => {
        calls.push({ cmd, args, opts });
        for (const { match, result } of handlers) {
            if (match(cmd, args)) return typeof result === 'function' ? result(cmd, args) : result;
        }
        return { status: 0, stdout: '', stderr: '' };
    };
    return { fn, calls };
}

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const fail = (status = 1, stderr = '', stdout = '') => ({ status, stdout, stderr });
const enoent = () => ({ status: null, error: { code: 'ENOENT' }, stdout: '', stderr: '' });

const isNpmVer = (cmd, args) => cmd === 'npm' && args[0] === '--version';
const isNpmInstall = (cmd, args) => cmd === 'npm' && args[0] === 'install' && args[1] === '-g';
const isNpmPrefix = (cmd, args) => cmd === 'npm' && args[0] === 'prefix';
const isWhich = (cmd) => cmd === 'which' || cmd === 'where';

// ── pickCommand ─────────────────────────────────────────────────────────

test('pickCommand: explicit global mode', () => {
    assert.equal(pickCommand('/x/lean.mjs', 'global'), 'lean-statusline');
});

test('pickCommand: explicit npx mode', () => {
    assert.equal(pickCommand('/x/lean.mjs', 'npx'), 'npx -y lean-statusline@latest');
});

test('pickCommand: explicit node mode', () => {
    assert.equal(pickCommand('/x/y.mjs', 'node'), 'node "/x/y.mjs"');
});

test('pickCommand: auto-detect falls back to direct node when not on PATH', () => {
    // On a CI host without `lean-statusline` on PATH the auto-detect must
    // fall through to the direct-`node` form. Critical regression guard:
    // it must NOT pick the npx form anymore (1.6.0 priority flip).
    const path = process.env.PATH;
    process.env.PATH = '/nonexistent';
    try {
        const out = pickCommand('/x/y.mjs');
        assert.ok(out === 'lean-statusline' || out === 'node "/x/y.mjs"',
            `unexpected auto-detect result: ${out}`);
        assert.ok(!out.startsWith('npx '), 'auto-detect must never pick npx form');
    } finally {
        process.env.PATH = path;
    }
});

// ── pickSubagentCommand ─────────────────────────────────────────────────

test('pickSubagentCommand: explicit global mode', () => {
    assert.equal(pickSubagentCommand('/x/y.mjs', 'global'), 'lean-statusline-subagents');
});

test('pickSubagentCommand: explicit npx mode', () => {
    assert.equal(pickSubagentCommand('/x/y.mjs', 'npx'), 'npx -y -p lean-statusline@latest lean-statusline-subagents');
});

test('pickSubagentCommand: explicit node mode', () => {
    assert.equal(pickSubagentCommand('/x/y.mjs', 'node'), 'node "/x/y.mjs"');
});

test('pickSubagentCommand: auto-detect never picks npx form', () => {
    const path = process.env.PATH;
    process.env.PATH = '/nonexistent';
    try {
        const out = pickSubagentCommand('/x/y.mjs');
        assert.ok(!out.startsWith('npx '), 'auto-detect must never pick npx form');
    } finally {
        process.env.PATH = path;
    }
});

// ── ensureGlobalInstall ─────────────────────────────────────────────────

test('ensureGlobalInstall: short-circuits when bin is already on PATH', async () => {
    const { fn, calls } = makeSpawnStub([
        { match: isNpmVer, result: ok('11.12.1\n') },
        { match: isWhich, result: ok('/usr/local/bin/lean-statusline\n') },
    ]);
    const r = await ensureGlobalInstall({ spawn: fn });
    assert.equal(r.action, 'already-present');
    assert.equal(r.binPath, '/usr/local/bin/lean-statusline');
    assert.ok(!calls.some(c => isNpmInstall(c.cmd, c.args)),
        'must not run `npm install -g` when bin is already present');
});

test('ensureGlobalInstall: installs when bin is missing then visible', async () => {
    let pathLookups = 0;
    const { fn, calls } = makeSpawnStub([
        { match: isNpmVer, result: ok('11.12.1\n') },
        {
            match: isWhich,
            result: () => {
                pathLookups++;
                return pathLookups === 1 ? fail(1) : ok('/usr/local/bin/lean-statusline\n');
            },
        },
        { match: isNpmInstall, result: ok() },
    ]);
    const r = await ensureGlobalInstall({ spawn: fn });
    assert.equal(r.action, 'installed');
    assert.equal(r.binPath, '/usr/local/bin/lean-statusline');
    assert.ok(calls.some(c => isNpmInstall(c.cmd, c.args)),
        'must run `npm install -g`');
});

test('ensureGlobalInstall: throws NPM_NOT_FOUND on ENOENT', async () => {
    const { fn } = makeSpawnStub([
        { match: isNpmVer, result: enoent() },
    ]);
    await assert.rejects(
        () => ensureGlobalInstall({ spawn: fn }),
        err => err.code === 'NPM_NOT_FOUND',
    );
});

test('ensureGlobalInstall: throws NPM_NOT_FOUND on non-zero exit', async () => {
    const { fn } = makeSpawnStub([
        { match: isNpmVer, result: fail(127) },
    ]);
    await assert.rejects(
        () => ensureGlobalInstall({ spawn: fn }),
        err => err.code === 'NPM_NOT_FOUND',
    );
});

test('ensureGlobalInstall: throws NPM_INSTALL_FAILED with stderr attached', async () => {
    const { fn } = makeSpawnStub([
        { match: isNpmVer, result: ok('11.12.1\n') },
        { match: isWhich, result: fail(1) },
        { match: isNpmInstall, result: fail(1, 'EACCES: permission denied') },
    ]);
    await assert.rejects(
        () => ensureGlobalInstall({ spawn: fn }),
        err => err.code === 'NPM_INSTALL_FAILED'
            && err.status === 1
            && err.stderr.includes('EACCES'),
    );
});

test('ensureGlobalInstall: throws BIN_NOT_ON_PATH when install ok but bin still missing', async () => {
    const { fn } = makeSpawnStub([
        { match: isNpmVer, result: ok('11.12.1\n') },
        { match: isWhich, result: fail(1) },
        { match: isNpmInstall, result: ok() },
        { match: isNpmPrefix, result: ok('/Users/x/.npm-global\n') },
    ]);
    await assert.rejects(
        () => ensureGlobalInstall({ spawn: fn }),
        err => err.code === 'BIN_NOT_ON_PATH'
            && (err.npmPrefixBin === '/Users/x/.npm-global/bin'
                || err.npmPrefixBin === '/Users/x/.npm-global'),
    );
});

test('ensureGlobalInstall: skipIfPresent=false reinstalls even when bin is on PATH', async () => {
    const { fn, calls } = makeSpawnStub([
        { match: isNpmVer, result: ok('11.12.1\n') },
        { match: isWhich, result: ok('/usr/local/bin/lean-statusline\n') },
        { match: isNpmInstall, result: ok() },
    ]);
    const r = await ensureGlobalInstall({ spawn: fn, skipIfPresent: false });
    assert.equal(r.action, 'reinstalled');
    assert.ok(calls.some(c => isNpmInstall(c.cmd, c.args)),
        'must run `npm install -g` when skipIfPresent is false');
});

test('ensureGlobalInstall: passes the version through to npm install -g', async () => {
    let lookups = 0;
    const { fn, calls } = makeSpawnStub([
        { match: isNpmVer, result: ok('11.12.1\n') },
        {
            match: isWhich,
            result: () => (++lookups === 1 ? fail(1) : ok('/usr/local/bin/lean-statusline\n')),
        },
        { match: isNpmInstall, result: ok() },
    ]);
    await ensureGlobalInstall({ spawn: fn, version: '1.6.0' });
    const installCall = calls.find(c => isNpmInstall(c.cmd, c.args));
    assert.ok(installCall, 'expected an `npm install -g` call');
    assert.equal(installCall.args[2], 'lean-statusline@1.6.0');
});
