import { OSC_BEL_TERMINATOR, OSC_ST_TERMINATOR } from "./osc.js";

const OSC7_PREFIX = "\x1b]7;";

const extractOsc7Path = (url: string): string | null => {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
};

export const parseOsc7FromChunk = (data: string): string | null => {
  let searchFrom = 0;
  let lastPath: string | null = null;

  while (searchFrom < data.length) {
    const sequenceStart = data.indexOf(OSC7_PREFIX, searchFrom);
    if (sequenceStart === -1) break;

    const payloadStart = sequenceStart + OSC7_PREFIX.length;
    const belIndex = data.indexOf(OSC_BEL_TERMINATOR, payloadStart);
    const stIndex = data.indexOf(OSC_ST_TERMINATOR, payloadStart);
    const payloadEnd =
      belIndex !== -1 && (stIndex === -1 || belIndex < stIndex) ? belIndex : stIndex;
    if (payloadEnd === -1) break;

    const path = extractOsc7Path(data.slice(payloadStart, payloadEnd));
    if (path) lastPath = path;
    // BEL is 1 byte, ST is 2 bytes — skip the correct amount so we don't
    // re-scan the terminator bytes as the start of the next sequence.
    searchFrom = payloadEnd + (payloadEnd === belIndex ? 1 : 2);
  }

  return lastPath;
};
