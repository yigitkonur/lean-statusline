// Verifies the 1.5.0 palette/barStyle/spacing back-compat remap. Saved configs
// pointing at dropped palettes (nord, tokyo-night, gruvbox, etc.) silently
// load into the nearest kept palette and emit a one-line deprecation note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, PALETTE_ALIASES, BAR_STYLE_ALIASES } from '../lib/config.mjs';

function withConfig(raw, fn) {
    const dir = mkdtempSync(join(tmpdir(), 'lean-pal-mig-'));
    const path = join(dir, '.claude', 'lean-statusline.json');
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(path, JSON.stringify(raw));
    const prev = process.env.LEAN_STATUSLINE_CONFIG;
    process.env.LEAN_STATUSLINE_CONFIG = path;
    try { return fn(); }
    finally {
        if (prev === undefined) delete process.env.LEAN_STATUSLINE_CONFIG;
        else process.env.LEAN_STATUSLINE_CONFIG = prev;
        rmSync(dir, { recursive: true, force: true });
    }
}

test('palette migrate: PALETTE_ALIASES table covers every dropped palette', () => {
    // Spot-check: the aliases table should map the old 1.4.0 names onto the
    // kept 1.5.0 set (solarized / rose-pine / catppuccin / catppuccin-latte /
    // dracula / monochrome).
    assert.equal(PALETTE_ALIASES.nord, 'solarized');
    assert.equal(PALETTE_ALIASES['tokyo-night'], 'solarized');
    assert.equal(PALETTE_ALIASES.gruvbox, 'solarized');
    assert.equal(PALETTE_ALIASES['rose-pine-moon'], 'rose-pine');
    assert.equal(PALETTE_ALIASES['catppuccin-frappe'], 'catppuccin');
    assert.equal(PALETTE_ALIASES['ayu-light'], 'catppuccin-latte');
});

test('palette migrate: loading a config with `gruvbox` remaps to `solarized`', () => {
    withConfig({ palette: 'gruvbox' }, () => {
        const { config, warnings } = loadConfig();
        assert.equal(config.palette, 'solarized');
        assert.ok(warnings.some(w => w.includes('gruvbox') && w.includes('solarized')));
    });
});

test('palette migrate: dropped barStyle (hearts) remaps to dots', () => {
    withConfig({ barStyle: 'hearts' }, () => {
        const { config, warnings } = loadConfig();
        assert.equal(config.barStyle, 'dots');
        assert.ok(warnings.some(w => w.includes('hearts')));
    });
});

test('palette migrate: `tight` spacing remaps to `normal`', () => {
    withConfig({ spacing: 'tight' }, () => {
        const { config, warnings } = loadConfig();
        assert.equal(config.spacing, 'normal');
        assert.ok(warnings.some(w => w.includes('tight')));
    });
});

test('palette migrate: removed fields (costPrecision, branchStyle, …) are stripped', () => {
    withConfig({
        costPrecision: 3,
        branchStyle: 'brace',
        branchMaxLen: 20,
        compactNumbers: true,
        ctxBarWidth: 40,
        show: { zap: true, bars: false },
    }, () => {
        const { config, warnings } = loadConfig();
        assert.equal(config.costPrecision, undefined);
        assert.equal(config.branchStyle, undefined);
        assert.equal(config.branchMaxLen, undefined);
        assert.equal(config.compactNumbers, undefined);
        assert.equal(config.ctxBarWidth, undefined);
        assert.equal(config.show.zap, undefined);
        assert.equal(config.show.bars, undefined);
        // At least one deprecation warning per removed key.
        assert.ok(warnings.some(w => w.includes('costPrecision')));
        assert.ok(warnings.some(w => w.includes('show.zap')));
    });
});

test('palette migrate: kept palettes pass through untouched', () => {
    for (const kept of ['solarized', 'rose-pine', 'catppuccin', 'catppuccin-latte', 'dracula', 'monochrome']) {
        withConfig({ palette: kept }, () => {
            const { config, warnings } = loadConfig();
            assert.equal(config.palette, kept);
            // No palette warning for kept names.
            assert.ok(!warnings.some(w => w.includes(`palette "${kept}"`)));
        });
    }
});

// Sanity-check BAR_STYLE_ALIASES alongside palette aliases for symmetry.
test('palette migrate: BAR_STYLE_ALIASES covers all dropped bar styles', () => {
    for (const dropped of ['braille', 'hearts', 'arrows', 'triangles']) {
        assert.equal(BAR_STYLE_ALIASES[dropped], 'dots', `${dropped} should remap to dots`);
    }
});
