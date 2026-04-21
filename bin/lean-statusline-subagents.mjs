#!/usr/bin/env node
// Subagent status line renderer for Claude Code's `subagentStatusLine` setting.
// CC pipes a JSON object with a `tasks` array to stdin; we write one JSON line
// per task we want to override: {"id":"<task-id>","content":"<rendered row>"}.
// Omitting a task id keeps CC's default row for that task.
import { makePalette, colorsEnabled, pickIcons, applyBarStyle } from '../lib/colors.mjs';
import { loadConfig, applyEnvOverrides } from '../lib/config.mjs';
import { renderTask } from '../lib/subagent-render.mjs';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw); } catch { process.exit(0); }

    const tasks = Array.isArray(input?.tasks) ? input.tasks : [];
    if (tasks.length === 0) process.exit(0);

    const { config } = loadConfig(input);
    const cfg = applyEnvOverrides(config);
    const colors = colorsEnabled(undefined, cfg.colors);
    const palette = makePalette(colors, cfg.palette);
    const icons = applyBarStyle(pickIcons(cfg.icons), cfg.barStyle);

    const now = Date.now();
    for (const task of tasks) {
        if (!task?.id) continue;
        const content = renderTask(task, palette, icons, now);
        process.stdout.write(JSON.stringify({ id: task.id, content }) + '\n');
    }
    process.exit(0);
});
