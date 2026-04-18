// Shared terminal primitives — ANSI constants, key parsing, raw-mode
// lifecycle. Used by both the full wizard TUI (lib/wizard.mjs) and the
// entry menu (bin/lean-statusline.mjs). Keeping them in one place prevents
// drift — e.g., the wizard learns a new key sequence, the menu silently
// doesn't.

export const CLEAR    = '\x1b[2J\x1b[3J\x1b[H';
export const HIDE_CUR = '\x1b[?25l';
export const SHOW_CUR = '\x1b[?25h';
export const BOLD     = '\x1b[1m';
export const DIM      = '\x1b[2m';
export const REV      = '\x1b[7m';
export const RESET    = '\x1b[0m';
export const C_GREEN  = '\x1b[32m';
export const C_CYAN   = '\x1b[36m';
export const C_YELLOW = '\x1b[33m';
export const C_RED    = '\x1b[31m';
export const C_MAG    = '\x1b[35m';

export const MOVE = (row, col) => `\x1b[${row};${col}H`;
export const HR   = (w) => DIM + '─'.repeat(w) + RESET;

// Normalize one stdin chunk (in raw mode) into a canonical key name.
// Returns the literal chunk for regular characters.
export function parseKey(chunk) {
    switch (chunk) {
        case '\x03':    return 'ctrl-c';
        case '\r':
        case '\n':      return 'enter';
        case '\t':      return 'tab';
        case ' ':       return 'space';
        case '\x1b':    return 'esc';
        case '\x1b[A':  return 'up';
        case '\x1b[B':  return 'down';
        case '\x1b[C':  return 'right';
        case '\x1b[D':  return 'left';
        case '\x1b[5~': return 'pageup';
        case '\x1b[6~': return 'pagedown';
        case '\x1b[H':
        case '\x1b[1~': return 'home';
        case '\x1b[F':
        case '\x1b[4~': return 'end';
        case '\x1b[Z':  return 'shift-tab';  // xterm
        default:        return chunk;
    }
}

// Read one parsed key from stdin. Stdin must already be in raw mode
// (caller responsibility, done once per session via enterRawMode).
export function readKey() {
    return new Promise(resolve => {
        const stdin = process.stdin;
        const onData = (chunk) => {
            stdin.removeListener('data', onData);
            resolve(parseKey(chunk));
        };
        stdin.on('data', onData);
    });
}

// Enter raw mode + hide cursor. Returns a cleanup() that restores both.
// Safe to call cleanup() multiple times.
//
// Windows notes:
//   - process.stdin.isTTY is false under MinTTY (Git Bash); setRawMode?.()
//     becomes a no-op which is fine — the caller's TTY-requirement check
//     should already have refused to enter the wizard.
//   - SIGINT is suppressed in raw mode on Windows. We detect the \x03 byte
//     directly in parseKey() and exit there, so this isn't a blocker.
//   - cleanup() must pause stdin before the process exits — otherwise the
//     raw-mode read keeps the event loop alive and the process hangs.
export function enterRawMode() {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    process.stdout.write(HIDE_CUR);
    let cleaned = false;
    return function cleanup() {
        if (cleaned) return;
        cleaned = true;
        try {
            stdin.setRawMode?.(wasRaw || false);
            stdin.pause();
            process.stdout.write(SHOW_CUR);
        } catch { /* ignore */ }
    };
}

// Strip ANSI escape codes for width calculations.
export function stripAnsi(s) {
    return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}
