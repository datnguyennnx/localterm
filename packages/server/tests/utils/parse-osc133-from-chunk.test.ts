import { describe, expect, it } from "vite-plus/test";
import { parseOsc133FromChunk } from "../../src/utils/parse-osc133-from-chunk.js";

describe("parseOsc133FromChunk", () => {
  it("extracts prompt-start from a simple chunk", () => {
    const result = parseOsc133FromChunk("\x1b]133;A\x07");
    expect(result).toEqual({ phase: "prompt-start" });
  });

  it("extracts command-start", () => {
    const result = parseOsc133FromChunk("\x1b]133;B\x07");
    expect(result).toEqual({ phase: "command-start" });
  });

  it("extracts output-start", () => {
    const result = parseOsc133FromChunk("\x1b]133;C\x1b\\");
    expect(result).toEqual({ phase: "output-start" });
  });

  it("extracts command-end with exit code 0", () => {
    const result = parseOsc133FromChunk("\x1b]133;D;0\x07");
    expect(result).toEqual({ phase: "command-end", exitCode: 0 });
  });

  it("extracts command-end with non-zero exit code", () => {
    const result = parseOsc133FromChunk("\x1b]133;D;127\x07");
    expect(result).toEqual({ phase: "command-end", exitCode: 127 });
  });

  it("handles BEL terminator", () => {
    const result = parseOsc133FromChunk("prefix\x1b]133;A\x07suffix");
    expect(result).toEqual({ phase: "prompt-start" });
  });

  it("handles ST terminator", () => {
    const result = parseOsc133FromChunk("prefix\x1b]133;B\x1b\\suffix");
    expect(result).toEqual({ phase: "command-start" });
  });

  it("returns last boundary when multiple are present", () => {
    const result = parseOsc133FromChunk("\x1b]133;A\x07text\x1b]133;C\x07");
    expect(result).toEqual({ phase: "output-start" });
  });

  it("returns null when no OSC 133 sequence is present", () => {
    const result = parseOsc133FromChunk("plain text\nwith no escapes");
    expect(result).toBeNull();
  });

  it("returns null when sequence is incomplete (no terminator)", () => {
    const result = parseOsc133FromChunk("\x1b]133;A");
    expect(result).toBeNull();
  });

  it("skips OSC sequences with other identifiers", () => {
    const result = parseOsc133FromChunk("\x1b]7;file://localhost/home\x07");
    expect(result).toBeNull();
  });

  it("handles mixed content with multiple sequences", () => {
    const chunk = "before\x1b]133;A\x07prompt\x1b]133;B\x07ls -la\r\n\x1b]133;C\x07file1  file2\r\n\x1b]133;D;0\x07after";
    const result = parseOsc133FromChunk(chunk);
    expect(result).toEqual({ phase: "command-end", exitCode: 0 });
  });
});
