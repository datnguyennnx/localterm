import { describe, expect, it } from "vite-plus/test";
import { MAX_PENDING_PARSE_BYTES } from "../src/constants.js";
import { OscChunkParser } from "../src/parser/osc.js";

/**
 * A parse function that extracts the payload after OSC 999 sequences.
 * OSC 999 is an arbitrary non-conflicting identifier for testing.
 * Format: \x1b]999;<payload>\x07
 */
const testOscParse = (data: string): string | null => {
  const prefix = "\x1b]999;";
  let searchFrom = 0;
  let last: string | null = null;
  while (searchFrom < data.length) {
    const start = data.indexOf(prefix, searchFrom);
    if (start === -1) break;
    const payloadStart = start + prefix.length;
    const end = data.indexOf("\x07", payloadStart);
    if (end === -1) break;
    last = data.slice(payloadStart, end);
    searchFrom = end + 1;
  }
  return last;
};

describe("OscChunkParser (generic)", () => {
  it("returns the parse result for a complete sequence in one chunk", () => {
    const parser = new OscChunkParser(testOscParse);
    expect(parser.push("\x1b]999;hello\x07")).toBe("hello");
  });

  it("returns null when no complete OSC sequence exists", () => {
    const parser = new OscChunkParser(testOscParse);
    expect(parser.push("no sequence here")).toBeNull();
  });

  it("buffers partial data that looks like the start of an OSC sequence", () => {
    const parser = new OscChunkParser(testOscParse);
    // Starts with \x1b] but no terminator yet → returns null, buffers the tail
    expect(parser.push("prefix \x1b]999;hello")).toBeNull();
    // Complete the sequence — combined with pending buffer, parse should find it
    expect(parser.push("\x07 suffix")).toBe("hello");
  });

  it("buffers data ending with the ESC byte alone", () => {
    const parser = new OscChunkParser(testOscParse);
    expect(parser.push("text\x1b")).toBeNull();
    // The ESC should have been buffered; next chunk completes the sequence
    expect(parser.push("]999;hello\x07")).toBe("hello");
  });

  it("returns the last result from combined pending + new data", () => {
    const parser = new OscChunkParser(testOscParse);
    // First chunk has a complete result plus the start of another incomplete sequence
    expect(parser.push("\x1b]999;first\x07 trailing \x1b]999;second")).toBe("first");
    // Second chunk completes the pending tail (just the terminator)
    expect(parser.push("\x07")).toBe("second");
  });

  it("discards stale pending data that exceeds MAX_PENDING_PARSE_BYTES", () => {
    const parser = new OscChunkParser(testOscParse);
    // The tail from the last \x1b] to the end must exceed MAX_PENDING_PARSE_BYTES
    // to be discarded. "\x1b]999;" is 7 bytes, plus 4096 bytes of padding = 4103 > 4096.
    const padding = "x".repeat(MAX_PENDING_PARSE_BYTES);
    expect(parser.push("\x1b]999;" + padding)).toBeNull();
    // The pending buffer should exceed the max and be discarded.
    // A fresh complete sequence in the next chunk should be parsed independently.
    expect(parser.push("\x1b]999;world\x07")).toBe("world");
  });

  it("reset() clears buffered data", () => {
    const parser = new OscChunkParser(testOscParse);
    parser.push("\x1b]999;");
    parser.reset();
    expect(parser.push("hello\x07")).toBeNull();
  });

  it("does not buffer data without any ESC sequence start", () => {
    const parser = new OscChunkParser(testOscParse);
    expect(parser.push("plain text")).toBeNull();
    // Next chunk should be parsed independently
    expect(parser.push("\x1b]999;hello\x07")).toBe("hello");
  });

  it("handles multiple complete OSC sequences and returns the last one", () => {
    const parser = new OscChunkParser(testOscParse);
    const result = parser.push("\x1b]999;first\x07 \x1b]999;second\x07");
    expect(result).toBe("second");
  });

  it("works with a parse function returning structured objects", () => {
    type ObjResult = { value: number } | null;
    const parseObj = (data: string): ObjResult => {
      const prefix = "\x1b]888;";
      let searchFrom = 0;
      let last: ObjResult = null;
      while (searchFrom < data.length) {
        const start = data.indexOf(prefix, searchFrom);
        if (start === -1) break;
        const payloadStart = start + prefix.length;
        const end = data.indexOf("\x07", payloadStart);
        if (end === -1) break;
        const payload = data.slice(payloadStart, end);
        if (/^\d+$/.test(payload)) last = { value: Number(payload) };
        searchFrom = end + 1;
      }
      return last;
    };

    const parser = new OscChunkParser<ObjResult>(parseObj);
    expect(parser.push("\x1b]888;42\x07")).toEqual({ value: 42 });
    expect(parser.push("\x1b]888;abc\x07")).toBeNull();
  });
});
