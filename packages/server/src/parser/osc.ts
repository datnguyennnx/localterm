import { MAX_PENDING_PARSE_BYTES } from "../constants.js";

/**
 * BEL (0x07) terminator for OSC sequences — used by common terminal emulators
 * (xterm, iTerm, kitty) to end an Operating System Command.
 */
export const OSC_BEL_TERMINATOR = "\x07";
/**
 * ST (0x1b 0x5c) terminator for OSC sequences – the formal ECMA-48 string
 * terminator that some programs emit instead of BEL.
 */
export const OSC_ST_TERMINATOR = "\x1b\\";

type OscParseFn<T> = (data: string) => T;

/**
 * Generic chunk-level parser for OSC (Operating System Command) sequences.
 *
 * Buffers partial data across `push()` calls so that sequences that arrive
 * split across TCP segments are still recognised.  The type parameter `T` is
 * the return type of the domain-specific parse function (e.g. `CommandBoundary`
 * for OSC 133, `string` for OSC 7).
 */
export class OscChunkParser<T> {
  private pending = "";

  constructor(private readonly parse: OscParseFn<T>) {}

  push(data: string): T | null {
    const combined = this.pending + data;
    this.pending = "";
    const result = this.parse(combined);
    const lastOscIndex = combined.lastIndexOf("\x1b]");
    const pendingStart =
      lastOscIndex !== -1 ? lastOscIndex : combined.endsWith("\x1b") ? combined.length - 1 : -1;
    if (pendingStart !== -1 && combined.length - pendingStart <= MAX_PENDING_PARSE_BYTES) {
      const tail = combined.slice(pendingStart);
      if (isIncompleteOsc(tail)) this.pending = tail;
    }
    return result;
  }

  reset(): void {
    this.pending = "";
  }
}

const isIncompleteOsc = (tail: string): boolean => {
  if (tail.length < 2) return true;
  if (tail[1] !== "]") return false;
  return !tail.includes(OSC_BEL_TERMINATOR, 2) && !tail.includes(OSC_ST_TERMINATOR, 2);
};
