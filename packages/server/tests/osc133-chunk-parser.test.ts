import { describe, expect, it } from "vite-plus/test";
import { Osc133ChunkParser } from "../src/osc133-chunk-parser.js";

describe("Osc133ChunkParser", () => {
  it("returns a boundary for a complete sequence in one chunk", () => {
    const parser = new Osc133ChunkParser();
    const result = parser.push("\x1b]133;A\x07");
    expect(result).toEqual({ phase: "prompt-start" });
  });

  it("handles split sequences across chunk boundaries", () => {
    const parser = new Osc133ChunkParser();
    expect(parser.push("\x1b]133;")).toBeNull();
    expect(parser.push("D;0\x07")).toEqual({ phase: "command-end", exitCode: 0 });
  });

  it("handles sequences split at the ESC byte", () => {
    const parser = new Osc133ChunkParser();
    expect(parser.push("text\x1b")).toBeNull();
    expect(parser.push("]133;A\x07")).toEqual({ phase: "prompt-start" });
  });

  it("handles sequences split at the ']' byte", () => {
    const parser = new Osc133ChunkParser();
    expect(parser.push("\x1b")).toBeNull();
    expect(parser.push("]133;B\x07")).toEqual({ phase: "command-start" });
  });

  it("discards stale pending data beyond MAX_PENDING_PARSE_BYTES", () => {
    const parser = new Osc133ChunkParser();
    const padding = "x".repeat(5000);
    expect(parser.push(padding + "\x1b")).toBeNull();
    // The ESC is the last byte, pending should be captured
    // Now send the rest — if pending is preserved, it should parse
    expect(parser.push("]133;D;0\x07")).toEqual({ phase: "command-end", exitCode: 0 });
  });

  it("returns the last boundary from combined pending + new data", () => {
    const parser = new Osc133ChunkParser();
    // First chunk contains a complete sequence (prompt-start) plus an incomplete tail
    expect(parser.push("\x1b]133;A\x07text\x1b]133;")).toEqual({ phase: "prompt-start" });
    // Second chunk completes the pending tail
    expect(parser.push("C\x07")).toEqual({ phase: "output-start" });
  });

  it("resets correctly", () => {
    const parser = new Osc133ChunkParser();
    parser.push("\x1b]133;");
    parser.reset();
    expect(parser.push("D;0\x07")).toBeNull();
  });
});
