import { MAX_PENDING_PARSE_BYTES } from "./constants.js";
import { parseOsc7FromChunk } from "./utils/parse-osc7-from-chunk.js";

export class Osc7ChunkParser {
  private pending = "";

  push(data: string): string | null {
    const combined = this.pending + data;
    this.pending = "";
    const path = parseOsc7FromChunk(combined);
    const lastOscIndex = combined.lastIndexOf("\x1b]");
    const pendingStart =
      lastOscIndex !== -1 ? lastOscIndex : combined.endsWith("\x1b") ? combined.length - 1 : -1;
    if (pendingStart !== -1 && combined.length - pendingStart <= MAX_PENDING_PARSE_BYTES) {
      const tail = combined.slice(pendingStart);
      if (this.isIncompleteOsc(tail)) this.pending = tail;
    }
    return path;
  }

  reset(): void {
    this.pending = "";
  }

  private isIncompleteOsc(tail: string): boolean {
    if (tail.length < 2) return true;
    if (tail[1] !== "]") return false;
    return !tail.includes("\x07", 2) && !tail.includes("\x1b\\", 2);
  }
}
