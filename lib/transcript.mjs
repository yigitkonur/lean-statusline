import { closeSync, openSync, readSync, statSync } from 'node:fs';

export function emptyTranscriptState() {
    return {
        lastTool: null,
        lastToolOk: null,
        failStreak: 0,
        subagents: {},
        cacheStats: null,
        pendingTools: {},
    };
}

function cloneTranscriptState(state) {
    const next = state && typeof state === 'object' ? structuredClone(state) : emptyTranscriptState();
    next.lastTool ??= null;
    next.lastToolOk ??= null;
    next.failStreak ??= 0;
    next.subagents ??= {};
    next.cacheStats ??= null;
    next.pendingTools ??= {};
    return next;
}

function readCacheCreation(usage) {
    return (usage?.cache_creation_input_tokens ?? 0)
        + (usage?.cache_creation?.ephemeral_5m_input_tokens ?? 0)
        + (usage?.cache_creation?.ephemeral_1h_input_tokens ?? 0);
}

function applyUsage(state, usage) {
    if (!usage || typeof usage !== 'object') return;
    state.cacheStats = {
        input: usage.input_tokens ?? 0,
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheCreation: readCacheCreation(usage),
    };
}

function applyAssistantBlocks(state, entry) {
    const blocks = Array.isArray(entry?.message?.content) ? entry.message.content : [];
    for (const block of blocks) {
        if (block?.type !== 'tool_use') continue;
        state.lastTool = block.name ?? state.lastTool;
        if (block.id) state.pendingTools[block.id] = block.name ?? null;
        if ((block.name === 'Task' || block.name === 'Agent') && block.id) {
            state.subagents[block.id] = {
                name: block.input?.subagent_type ?? block.input?.name ?? 'unknown',
                startedAt: Date.now(),
            };
        }
    }
}

function applyUserBlocks(state, entry) {
    const blocks = Array.isArray(entry?.message?.content) ? entry.message.content : [];
    for (const block of blocks) {
        if (block?.type !== 'tool_result') continue;
        const pending = block.tool_use_id ? state.pendingTools[block.tool_use_id] : null;
        if (pending) state.lastTool = pending;
        state.lastToolOk = !block.is_error;
        state.failStreak = block.is_error ? state.failStreak + 1 : 0;
        if (block.tool_use_id) {
            delete state.pendingTools[block.tool_use_id];
            delete state.subagents[block.tool_use_id];
        }
    }
}

function applyToReducer(state, entry) {
    if (!entry || typeof entry !== 'object') return;
    applyUsage(state, entry.message?.usage);
    if (entry.type === 'assistant') applyAssistantBlocks(state, entry);
    if (entry.type === 'user') applyUserBlocks(state, entry);
}

export async function reduceTranscript(path, prevOffset = 0, prevState = null, maxMs = 500) {
    if (!path) {
        return { offset: 0, state: emptyTranscriptState() };
    }

    let stat;
    try {
        stat = statSync(path);
    } catch {
        return { offset: 0, state: emptyTranscriptState() };
    }

    const startOffset = stat.size < prevOffset ? 0 : Math.max(0, prevOffset || 0);
    const state = startOffset === 0 ? emptyTranscriptState() : cloneTranscriptState(prevState);
    if (startOffset === stat.size) {
        return { offset: stat.size, state };
    }

    const fd = openSync(path, 'r');
    try {
        const size = stat.size - startOffset;
        const buffer = Buffer.allocUnsafe(size);
        const bytesRead = readSync(fd, buffer, 0, size, startOffset);
        if (bytesRead <= 0) return { offset: startOffset, state };

        const chunk = buffer.subarray(0, bytesRead).toString('utf8');
        const lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline < 0) return { offset: startOffset, state };

        const deadline = Date.now() + maxMs;
        const lines = chunk.slice(0, lastNewline).split('\n');
        let cursor = startOffset;
        for (const line of lines) {
            const byteLen = Buffer.byteLength(line, 'utf8') + 1;
            if (Date.now() > deadline) break;
            if (line.trim()) {
                try {
                    applyToReducer(state, JSON.parse(line));
                } catch {
                    // Skip malformed lines and resume on the next complete record.
                }
            }
            cursor += byteLen;
        }
        return { offset: cursor, state };
    } finally {
        closeSync(fd);
    }
}
