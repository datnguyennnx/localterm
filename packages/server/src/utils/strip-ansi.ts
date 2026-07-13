/* eslint-disable no-control-regex -- entire purpose is stripping control characters */

/**
 * Strip ANSI/VT escape sequences from terminal output, keeping visible text.
 * Minimal implementation — handles the common CSI SGR/cursor/move sequences,
 * OSC sequences, and other escape codes produced by modern shells and TUIs.
 * Does NOT handle every possible VT sequence; coverage is bounded by the
 * sequences observed in common shell output (bash/zsh prompts, common TUIs,
 * build tools, package managers).
 *
 * Not a streaming parser — input must be a complete string chunk.
 * For split sequences across chunks, the caller should concatenate first.
 */
export const stripAnsi = (input: string): string => {
  return input
    // OSC sequences: ESC ] ... ( ST | BEL )
    .replace(/\u001b\].*?(?:\u001b\\|\u0007)/g, "")
    // CSI sequences: ESC [ ... final byte
    .replace(/\u001b\[[\d;]*[A-Za-z@-~]/g, "")
    // Remaining ESC sequences: ESC [ intermediates ] final byte
    .replace(/\u001b\[[\u0020-\u002f]*[\u0030-\u007e]/g, "")
    // Other ESC sequences: ESC + optional intermediates + final
    .replace(/\u001b[\u0020-\u002f]*[\u0030-\u007e]/g, "")
    // 8-bit C1 control codes (CSI, OSC, etc.)
    .replace(/[\u009b\u009d\u0090\u0098\u009e\u009f]/g, "")
    // Remove other control chars except tab, newline, carriage return
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
};
