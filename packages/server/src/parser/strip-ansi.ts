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
  // Multiple passes: each regex targets one family of escape sequences.
  // A single combined regex is more fragile across the different byte ranges
  // used by each family (OSC, CSI, ESC, C1, C0).  Five passes over the string
  // is trivially fast at realistic terminal output sizes (KB–low MB).
  return input
    .replace(/\u001b\](?:.*?(?:\u001b\\|\u0007))/g, "")
    .replace(/\u001b\[[\d;]*[A-Za-z@-~]/g, "")
    .replace(/\u001b\[[\u0020-\u002f]*[\u0040-\u007e]/g, "")
    .replace(/\u001b[\u0020-\u002f]*[\u0030-\u007e]/g, "")
    .replace(/[\u009b\u009d\u0090\u0098\u009e\u009f]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
};
