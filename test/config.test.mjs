import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, loadConfig, resolveConfigPath } from '../lib/config.mjs';
import { PRESETS } from '../lib/presets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'lean-statusline.mjs');

function makeSandbox() {
    const root = mkdtempSync(join(tmpdir(), 'lean-config-'));
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

test('config: env override path wins over project and user files', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        const envPath = join(root, 'env-config.json');
        writeJson(envPath, { separator: '|' });
        writeJson(join(projectDir, '.claude', 'lean-statusline.json'), { separator: '/' });
        writeJson(join(homeDir, '.claude', 'lean-statusline.json'), { separator: ':' });

        assert.equal(resolveConfigPath({ workspace: { project_dir: projectDir } }, {
            env: { LEAN_STATUSLINE_CONFIG: envPath },
            homeDir,
            cwd: projectDir,
        }), envPath);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('config: project-local .claude file wins over user config', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        const projectPath = join(projectDir, '.claude', 'lean-statusline.json');
        writeJson(projectPath, { separator: '/', segments: ['model'] });
        writeJson(join(homeDir, '.claude', 'lean-statusline.json'), { separator: ':' });

        assert.equal(resolveConfigPath({ workspace: { project_dir: projectDir } }, {
            env: {},
            homeDir,
            cwd: projectDir,
        }), projectPath);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('config: alternate project file is used when .claude file is absent', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        const altPath = join(projectDir, 'lean-statusline.config.json');
        writeJson(altPath, { separator: '/', segments: ['model'] });

        assert.equal(resolveConfigPath({ workspace: { project_dir: projectDir } }, {
            env: {},
            homeDir,
            cwd: projectDir,
        }), altPath);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('config: chosen file merges only with defaults, not with lower-priority files', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        writeJson(join(homeDir, '.claude', 'lean-statusline.json'), {
            separator: '|',
            icons: 'ascii',
            show: { branch: false },
        });
        writeJson(join(projectDir, '.claude', 'lean-statusline.json'), {
            segments: ['model'],
        });

        const { config, path } = loadConfig({ workspace: { project_dir: projectDir } }, {
            env: {},
            homeDir,
            cwd: projectDir,
        });

        assert.equal(path, join(projectDir, '.claude', 'lean-statusline.json'));
        assert.deepEqual(config.segments, ['model']);
        assert.equal(config.separator, DEFAULTS.separator);
        assert.equal(config.icons, DEFAULTS.icons);
        assert.equal(config.show.branch, DEFAULTS.show.branch);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('config: cwd fallback lets CLI commands target project config when no stdin project_dir is available', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        const projectPath = join(projectDir, '.claude', 'lean-statusline.json');
        writeJson(projectPath, { separator: '/', segments: ['model'] });

        assert.equal(resolveConfigPath({}, {
            env: {},
            homeDir,
            cwd: projectDir,
        }), projectPath);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('cli: config --init-project-file seeds a project config from the active resolved config', () => {
    const { root, projectDir } = makeSandbox();
    try {
        const sourcePath = join(root, 'source.json');
        writeJson(sourcePath, { segments: ['model', 'ctx'], separator: '|' });

        const result = spawnSync(process.execPath, [BIN, 'config', '--init-project-file'], {
            cwd: projectDir,
            env: {
                ...process.env,
                LEAN_STATUSLINE_CONFIG: sourcePath,
            },
            encoding: 'utf8',
            timeout: 5000,
        });

        assert.equal(result.status, 0, result.stderr);
        const seededPath = join(projectDir, '.claude', 'lean-statusline.json');
        const seeded = JSON.parse(readFileSync(seededPath, 'utf8'));
        assert.deepEqual(seeded.segments, ['model', 'ctx']);
        assert.equal(seeded.separator, '|');
        assert.match(result.stdout, /initialized project config/i);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('cli: install --preset writes the resolved project config, not the user default path', () => {
    const { root, homeDir, projectDir } = makeSandbox();
    try {
        const projectPath = join(projectDir, '.claude', 'lean-statusline.json');
        const userPath = join(homeDir, '.claude', 'lean-statusline.json');
        const claudeHome = join(root, 'claude-home');
        writeJson(projectPath, { preset: 'minimal', segments: ['model'], separator: '/' });

        const result = spawnSync(process.execPath, [BIN, 'install', '--preset', 'full', '--no-patch', '--no-wizard'], {
            cwd: projectDir,
            env: {
                ...process.env,
                HOME: homeDir,
                USERPROFILE: homeDir,
                LEAN_STATUSLINE_CLAUDE_HOME: claudeHome,
            },
            encoding: 'utf8',
            timeout: 5000,
        });

        assert.equal(result.status, 0, result.stderr);
        const projectCfg = JSON.parse(readFileSync(projectPath, 'utf8'));
        assert.deepEqual(projectCfg.segments, PRESETS.full.config.segments);
        assert.equal(existsSync(userPath), false);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
