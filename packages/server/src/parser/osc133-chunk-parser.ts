import { OscChunkParser } from "./osc.js";
import { parseOsc133FromChunk, type CommandBoundary } from "./parse-osc133-from-chunk.js";

export type { CommandBoundary };

/**
 * Backward-compatible subclass for OSC 133 FinalTerm command-boundary parsing.
 * Prefer `OscChunkParser<CommandBoundary | null>` from `osc.js`
 * for new code.
 */
export class Osc133ChunkParser extends OscChunkParser<CommandBoundary | null> {
  constructor() {
    super(parseOsc133FromChunk);
  }
}
