import { probe } from './probe.mjs';

const TAG_OPEN = '\x1e';
const TAG_CLOSE = '\x1f';
const ANSI_PATTERN = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

export const DEFAULT_LAYOUT = Object.freeze({
    tiers: Object.freeze({ xl: 150, l: 100, m: 76, s: 0 }),
    dropOrder: Object.freeze(['7d.bar', '7d.countdown', 'paceDelta', '7d.label', '7d.percent', '5h.countdown', '5h.pace', 'projectDirCrumb', 'lines', 'cost']),
    forceMinWidth: null,
});

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWideCodePoint(codePoint) {
    return (
        (codePoint >= 0x1100 && codePoint <= 0x115f)
        || (codePoint >= 0x2329 && codePoint <= 0x232a)
        || (codePoint >= 0x2e80 && codePoint <= 0xa4cf)
        || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
        || (codePoint >= 0xf900 && codePoint <= 0xfaff)
        || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
        || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
        || (codePoint >= 0xff00 && codePoint <= 0xff60)
        || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
        || (codePoint >= 0x1f300 && codePoint <= 0x1faff)
    );
}

export function tagPart(key, value) {
    if (!key || value == null || value === '') return value;
    return `${TAG_OPEN}${key}${TAG_CLOSE}${value}${TAG_OPEN}/${key}${TAG_CLOSE}`;
}

export function stripLayoutTags(value) {
    return String(value).replace(/\x1e\/?[^\x1f]+\x1f/g, '');
}

export function stripAnsi(value) {
    return String(value).replace(ANSI_PATTERN, '');
}

export function displayWidth(value) {
    const plain = stripAnsi(stripLayoutTags(value));
    let width = 0;
    for (const char of plain) {
        const codePoint = char.codePointAt(0) ?? 0;
        if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) continue;
        if (/\p{Mark}/u.test(char)) continue;
        width += isWideCodePoint(codePoint) ? 2 : 1;
    }
    return width;
}

export function resolveWidth(ctx, options = {}) {
    const forced = ctx?.cfg?.layout?.forceMinWidth;
    if (Number.isFinite(forced) && forced > 0) return forced;
    const fromPayload = probe('terminal.columns', ctx?.input ?? {}, { env: options.env ?? process.env });
    if (Number.isFinite(fromPayload) && fromPayload > 0) return fromPayload;
    return 100;
}

export function tierFor(width, tiers = DEFAULT_LAYOUT.tiers) {
    if (width >= tiers.xl) return 'xl';
    if (width >= tiers.l) return 'l';
    if (width >= tiers.m) return 'm';
    return 's';
}

function fits(rendered, width) {
    return stripLayoutTags(rendered)
        .split('\n')
        .every(line => displayWidth(line) <= width);
}

function stripByKey(rendered, key) {
    const escaped = escapeRegExp(key);
    const pattern = new RegExp(`${TAG_OPEN}${escaped}${TAG_CLOSE}[\\s\\S]*?${TAG_OPEN}\/${escaped}${TAG_CLOSE}`, 'g');
    return rendered.replace(pattern, '');
}

function separatorFor(ctx) {
    // 1.5.0: `tight` spacing dropped; saved configs get remapped to `normal` in
    // normalizeConfig so this branch only ever sees `normal` or `loose`.
    const pad = ctx.cfg.spacing === 'loose' ? '  ' : ' ';
    return `${pad}${ctx.palette.dim(ctx.cfg.separator)}${pad}`;
}

function cleanRendered(rendered, ctx) {
    const sep = separatorFor(ctx);
    const sepEsc = escapeRegExp(sep);
    return rendered
        .split('\n')
        .map(line => line
            .replace(new RegExp(`(?:${sepEsc}){2,}`, 'g'), sep)
            .replace(new RegExp(`^${sepEsc}+`, 'g'), '')
            .replace(new RegExp(`${sepEsc}+$`, 'g'), '')
            .replace(/^[ \t]+|[ \t]+$/g, ''))
        .filter(line => stripAnsi(stripLayoutTags(line)).trim() !== '')
        .join('\n');
}

// Walk a single line, keep ANSI escape sequences intact but drop visible
// chars past `max`. Appends `…`. 1.5.0 addition: the drop-ladder fallback
// can't always fit a line (e.g. a very long dir name on a narrow terminal),
// so the final escape-hatch is per-line ellipsis truncation.
function truncateLine(line, max) {
    if (max <= 1) return '';
    if (displayWidth(line) <= max) return line;
    const plain = stripAnsi(stripLayoutTags(line));
    // Fast path: no ANSI / no tags → simple slice.
    if (plain === line) {
        let w = 0;
        let out = '';
        for (const ch of line) {
            const cp = ch.codePointAt(0) ?? 0;
            if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) { out += ch; continue; }
            if (/\p{Mark}/u.test(ch)) { out += ch; continue; }
            const cw = isWideCodePoint(cp) ? 2 : 1;
            if (w + cw > max - 1) break;
            w += cw;
            out += ch;
        }
        return out + '…';
    }
    // Slow path: walk the raw string, keep ANSI state escapes intact, count
    // visible chars only. Stop at `max-1` visible cells, then append `…` and
    // a reset to clear any open ANSI state.
    let w = 0;
    let out = '';
    let i = 0;
    while (i < line.length) {
        // ANSI escape sequence — copy verbatim without counting visible width.
        if (line.charCodeAt(i) === 0x1b) {
            const match = line.slice(i).match(/^(?:\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07)/);
            if (match) { out += match[0]; i += match[0].length; continue; }
        }
        // Layout tag (TAG_OPEN…TAG_CLOSE) — also zero-width, copy verbatim.
        if (line.charCodeAt(i) === 0x1e) {
            const end = line.indexOf(TAG_CLOSE, i);
            if (end >= 0) { out += line.slice(i, end + 1); i = end + 1; continue; }
        }
        // Visible char — count and keep until we've hit max-1 cells.
        const ch = String.fromCodePoint(line.codePointAt(i));
        const cp = ch.codePointAt(0) ?? 0;
        const step = ch.length;
        if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f) || /\p{Mark}/u.test(ch)) {
            out += ch; i += step; continue;
        }
        const cw = isWideCodePoint(cp) ? 2 : 1;
        if (w + cw > max - 1) break;
        w += cw;
        out += ch;
        i += step;
    }
    return out + '\x1b[0m…';
}

export function applyLayout(ctx, rendered, width = resolveWidth(ctx)) {
    const order = ctx?.cfg?.layout?.dropOrder ?? DEFAULT_LAYOUT.dropOrder;
    let current = rendered;
    if (!fits(current, width)) {
        for (const key of order) {
            const next = cleanRendered(stripByKey(current, key), ctx);
            if (next === current) continue;
            current = next;
            if (fits(current, width)) break;
        }
    }
    const cleaned = stripLayoutTags(cleanRendered(current, ctx));
    // Final escape-hatch: per-line ellipsis truncation when drop ladder is
    // exhausted and the line still overflows. Rare in practice — most lines
    // are tagged heavily enough that drops resolve — but catches the edge
    // case of a single long dir-name or long branch.
    if (fits(cleaned, width)) return cleaned;
    return cleaned.split('\n').map(line => truncateLine(line, width)).join('\n');
}
