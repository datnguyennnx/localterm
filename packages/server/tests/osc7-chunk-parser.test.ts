import { describe, expect, it } from "vite-plus/test";
import { MAX_PENDING_PARSE_BYTES } from "../src/constants.js";
import { Osc7ChunkParser } from "../src/parser/osc7-chunk-parser.js";

describe("Osc7ChunkParser", () => {
  it("preserves BEL-terminated OSC 7 sequences across chunks", () => {
    const parser = new Osc7ChunkParser();
    expect(parser.push("prefix\x1b]7;file://localhost/My%20")).toBeNull();
    expect(parser.push("Project\x07suffix")).toBe("/My Project");
  });

  it("preserves ST-terminated OSC 7 sequences across chunks", () => {
    const parser = new Osc7ChunkParser();
    expect(parser.push("\x1b]7;file://localhost/tmp\x1b")).toBeNull();
    expect(parser.push("\\")).toBe("/tmp");
  });

  it("drops incomplete sequences that exceed the bounded pending buffer", () => {
    const parser = new Osc7ChunkParser();
    parser.push(`\x1b]7;file://localhost/${"x".repeat(MAX_PENDING_PARSE_BYTES)}`);
    expect(parser.push("\x07")).toBeNull();
  });
});
