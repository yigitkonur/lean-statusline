import { closeSync, openSync, readSync, statSync } from 'node:fs';

const READ_CHUNK_BYTES = 64 * 1024;

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

    let fd;
    try {
        fd = openSync(path, 'r');
    } catch {
        return { offset: startOffset, state };
    }

    try {
        const deadline = Date.now() + maxMs;
        const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES);
        let partial = Buffer.alloc(0);
        let fileOffset = startOffset;
        let cursor = startOffset;

        readLoop: while (fileOffset < stat.size) {
            if (Date.now() > deadline) break;
            const size = Math.min(buffer.length, stat.size - fileOffset);
            let bytesRead;
            try {
                bytesRead = readSync(fd, buffer, 0, size, fileOffset);
            } catch {
                return { offset: cursor, state };
            }
            if (bytesRead <= 0) break;

            const chunk = buffer.subarray(0, bytesRead);
            let lineStart = 0;
            for (let i = 0; i < bytesRead; i++) {
                if (chunk[i] !== 0x0a) continue;
                if (Date.now() > deadline) break readLoop;

                const lineChunk = chunk.subarray(lineStart, i);
                const lineBuffer = partial.length
                    ? Buffer.concat([partial, lineChunk])
                    : lineChunk;
                const line = lineBuffer.toString('utf8');
                if (line.trim()) {
                    try {
                        applyToReducer(state, JSON.parse(line));
                    } catch {
                        // Skip malformed lines and resume on the next complete record.
                    }
                }
                cursor = fileOffset + i + 1;
                partial = Buffer.alloc(0);
                lineStart = i + 1;
            }

            if (lineStart < bytesRead) {
                const remainder = chunk.subarray(lineStart, bytesRead);
                partial = partial.length
                    ? Buffer.concat([partial, remainder])
                    : Buffer.from(remainder);
            } else {
                partial = Buffer.alloc(0);
            }

            fileOffset += bytesRead;
        }

        return { offset: cursor, state };
    } finally {
        closeSync(fd);
    }
}
