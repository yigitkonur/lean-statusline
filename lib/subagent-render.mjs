// Renders a single subagent task row for subagentStatusLine.
// Pure function — no IO. Caller supplies task + palette + icons.

function fmtElapsed(ms) {
    if (!Number.isFinite(ms) || ms < 0) return null;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m${(s % 60).toString().padStart(2, '0')}s`;
    const h = Math.floor(m / 60);
    return `${h}h${(m % 60).toString().padStart(2, '0')}m`;
}

function fmtKTokens(n) {
    if (!n || n <= 0) return null;
    return `${Math.round(n / 1000)}k tok`;
}

export function renderTask(task, palette, icons) {
    const { name, status, tokenCount, startTime } = task ?? {};

    const statusIcon = status === 'done'    ? (icons?.done    ?? '✓')
                     : status === 'error'   ? (icons?.error   ?? '✗')
                     : status === 'paused'  ? (icons?.paused  ?? '⏸')
                     :                        (icons?.running  ?? '●');

    const statusColor = status === 'done'   ? palette.green
                      : status === 'error'  ? palette.red
                      : status === 'paused' ? palette.dim
                      :                       palette.yellow;

    const elapsed = startTime ? fmtElapsed(Date.now() - startTime) : null;
    const tokStr  = fmtKTokens(tokenCount);

    const parts = [
        `${statusColor(statusIcon)} ${palette.white(name ?? 'unknown')}`,
        tokStr   ? palette.dim(tokStr)   : null,
        elapsed  ? palette.dim(elapsed)  : null,
    ].filter(Boolean);

    return parts.join(' · ');
}
