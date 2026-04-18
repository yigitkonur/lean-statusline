import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { probe, UNSET } from './probe.mjs';

function readMetric(segmentName, rules, ctx) {
    const metricPath = rules?.threshold?.metric;
    if (metricPath) {
        const value = probe(metricPath, ctx.input);
        return value === UNSET ? null : value;
    }
    switch (segmentName) {
        case 'ctx':
        case 'context-bar':
            return ctx.contextPct ?? null;
        case '5h':
        case 'rate-5h-full':
            return ctx.rateLimits?.fiveHour?.pct ?? null;
        case '7d':
        case 'rate-7d-full':
            return ctx.rateLimits?.sevenDay?.pct ?? null;
        case 'cost': {
            const value = probe('cost.total_cost_usd', ctx.input);
            return value === UNSET ? null : value;
        }
        default:
            return null;
    }
}

function effectiveCwd(ctx) {
    return probe('workspace.current_dir', ctx.input)
        || probe('cwd', ctx.input)
        || process.cwd();
}

export function shouldRender(segmentName, ctx) {
    const rules = ctx.cfg?.conditionals?.[segmentName];
    if (!rules) return true;

    if (Array.isArray(rules.requires)) {
        for (const path of rules.requires) {
            const value = probe(path, ctx.input);
            if (value === UNSET || value == null) return false;
        }
    }

    if (rules.hide_when_equals && typeof rules.hide_when_equals === 'object') {
        for (const [path, values] of Object.entries(rules.hide_when_equals)) {
            const value = probe(path, ctx.input);
            if (Array.isArray(values) && values.includes(value)) return false;
        }
    }

    if (rules.hide_when_equals_all && typeof rules.hide_when_equals_all === 'object') {
        const entries = Object.entries(rules.hide_when_equals_all);
        if (entries.length > 0) {
            let allMatch = true;
            for (const [path, values] of entries) {
                const value = probe(path, ctx.input);
                if (!Array.isArray(values) || !values.includes(value)) {
                    allMatch = false;
                    break;
                }
            }
            if (allMatch) return false;
        }
    }

    if (rules.threshold?.hide_below != null) {
        const metric = readMetric(segmentName, rules, ctx);
        if (metric != null && metric < rules.threshold.hide_below) return false;
    }

    if (rules.max_messages != null) {
        const track = rules.max_messages_track;
        const seen = track ? (ctx.state?.counters?.messagesSinceLastChange?.[track] ?? 0) : 0;
        if (seen >= rules.max_messages) return false;
    }

    if (Array.isArray(rules.detect_files) && rules.detect_files.length) {
        const cwd = effectiveCwd(ctx);
        for (const relPath of rules.detect_files) {
            if (!existsSync(join(cwd, relPath))) return false;
        }
    }

    return true;
}
