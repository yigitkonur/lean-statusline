// Minimal PTY test harness. Launches the CLI in a real PTY so it sees
// isTTY=true and raw-mode stdin works. Consumed by test/*.test.mjs.
//
// Per research (2026-04), @lydell/node-pty is the actively-maintained fork:
// prebuilt binaries only (no node-gyp), <1 MB per platform, same API as
// microsoft/node-pty. Windows is excluded from this harness because ConPTY
// is flaky in CI (microsoft/node-pty#827, open 2025-12). Tests using this
// helper should skip on platform === 'win32'.
import { spawn as ptySpawn } from '@lydell/node-pty';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BIN = resolve(__dirname, '..', '..', 'bin', 'lean-statusline.mjs');

export const KEY = Object.freeze({
    Up:        '\x1b[A',
    Down:      '\x1b[B',
    Right:     '\x1b[C',
    Left:      '\x1b[D',
    Tab:       '\t',
    ShiftTab:  '\x1b[Z',
    Enter:     '\r',
    Space:     ' ',
    Esc:       '\x1b',
    CtrlC:     '\x03',
    PageDown:  '\x1b[6~',
    PageUp:    '\x1b[5~',
    Home:      '\x1b[H',
    End:       '\x1b[F',
});

export const stripAnsi = (s) =>
    String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][0-9;]*?\x07/g, '');

export function launch(args = [], env = {}) {
    const pty = ptySpawn(process.execPath, [BIN, ...args], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: process.cwd(),
        env: {
            ...process.env,
            TERM: 'xterm-256color',
            FORCE_COLOR: '1',
            // Isolate from the user's real config so tests never touch it.
            LEAN_STATUSLINE_CONFIG: env.LEAN_STATUSLINE_CONFIG || '/tmp/lean-test-noexist.json',
            LEAN_STATUSLINE_CLAUDE_HOME: env.LEAN_STATUSLINE_CLAUDE_HOME || '/tmp/lean-test-home',
            ...env,
        },
    });

    let buf = '';
    pty.onData((d) => { buf += d; });

    // Poll the rendered buffer (ANSI stripped) until `re` matches.
    // Rejects on timeout with the full buffer for debugging.
    const waitFor = (re, ms = 3000) =>
        new Promise((resolveP, reject) => {
            const start = Date.now();
            const tick = () => {
                if (re.test(stripAnsi(buf))) return resolveP(buf);
                if (Date.now() - start > ms) {
                    return reject(new Error(
                        `timeout waiting for ${re}\n--- stripped buf ---\n${stripAnsi(buf)}`
                    ));
                }
                setTimeout(tick, 20);
            };
            tick();
        });

    // Wait for process exit. Resolves with exit code.
    const waitExit = () =>
        new Promise((resolveP) => { pty.onExit(({ exitCode }) => resolveP(exitCode)); });

    // Send keys; optional delay between chunks so apps with debouncers see them.
    const send = async (keys, delayMs = 15) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) {
            pty.write(k);
            if (delayMs) await new Promise(r => setTimeout(r, delayMs));
        }
    };

    return {
        pty,
        get output() { return buf; },
        get plain()  { return stripAnsi(buf); },
        clear: () => { buf = ''; },
        send,
        waitFor,
        waitExit,
        kill: (sig = 'SIGINT') => pty.kill(sig),
    };
}
