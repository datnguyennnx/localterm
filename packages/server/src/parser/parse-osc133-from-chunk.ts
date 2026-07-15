import { OSC_BEL_TERMINATOR, OSC_ST_TERMINATOR } from "./osc.js";

export interface CommandBoundary {
  phase: "prompt-start" | "command-start" | "output-start" | "command-end";
  exitCode?: number;
}

const OSC133_PREFIX = "\x1b]133;";

/** Number of characters to skip past the "D;" prefix in a command-end payload. */
const OSC133_EXIT_CODE_OFFSET = 2;

const parseOsc133Payload = (payload: string): CommandBoundary | null => {
  if (payload.length === 0) return null;
  const letter = payload[0];
  if (letter === "A") return { phase: "prompt-start" };
  if (letter === "B") return { phase: "command-start" };
  if (letter === "C") return { phase: "output-start" };
  if (letter === "D") {
    if (payload.length <= OSC133_EXIT_CODE_OFFSET) return { phase: "command-end" };
    const exitCode = Number(payload.slice(OSC133_EXIT_CODE_OFFSET));
    return { phase: "command-end", exitCode: Number.isFinite(exitCode) ? exitCode : undefined };
  }
  return null;
};

/**
 * Scan a string chunk for OSC 133 FinalTerm sequences and return the last one found.
 * Returns null if no complete OSC 133 sequence is present.
 */
export const parseOsc133FromChunk = (data: string): CommandBoundary | null => {
  let searchFrom = 0;
  let lastBoundary: CommandBoundary | null = null;

  while (searchFrom < data.length) {
    const sequenceStart = data.indexOf(OSC133_PREFIX, searchFrom);
    if (sequenceStart === -1) break;

    const payloadStart = sequenceStart + OSC133_PREFIX.length;
    const belIndex = data.indexOf(OSC_BEL_TERMINATOR, payloadStart);
    const stIndex = data.indexOf(OSC_ST_TERMINATOR, payloadStart);
    const payloadEnd =
      belIndex !== -1 && (stIndex === -1 || belIndex < stIndex) ? belIndex : stIndex;
    if (payloadEnd === -1) break;

    const boundary = parseOsc133Payload(data.slice(payloadStart, payloadEnd));
    if (boundary) lastBoundary = boundary;
    // BEL is 1 byte, ST is 2 bytes — skip the correct amount so we don't
    // re-scan the terminator bytes as the start of the next sequence.
    searchFrom = payloadEnd + (payloadEnd === belIndex ? 1 : 2);
  }

  return lastBoundary;
};
