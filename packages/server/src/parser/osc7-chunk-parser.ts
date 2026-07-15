import { OscChunkParser } from "./osc.js";
import { parseOsc7FromChunk } from "./parse-osc7-from-chunk.js";

/**
 * Backward-compatible subclass for OSC 7 working-directory parsing.
 * Prefer `OscChunkParser<string | null>` from `osc.js`
 * for new code.
 */
export class Osc7ChunkParser extends OscChunkParser<string | null> {
  constructor() {
    super(parseOsc7FromChunk);
  }
}
