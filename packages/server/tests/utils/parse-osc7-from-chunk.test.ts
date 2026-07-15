import { describe, expect, it } from "vite-plus/test";
import { parseOsc7FromChunk } from "../../src/parser/parse-osc7-from-chunk.js";

describe("parseOsc7FromChunk", () => {
  it("decodes BEL-terminated file URLs", () => {
    expect(parseOsc7FromChunk("\x1b]7;file://localhost/Users/test/My%20Project\x07")).toBe(
      "/Users/test/My Project",
    );
  });

  it("decodes ST-terminated file URLs", () => {
    expect(parseOsc7FromChunk("\x1b]7;file://localhost/tmp\x1b\\")).toBe("/tmp");
  });

  it("returns the final complete sequence and ignores incomplete tails", () => {
    expect(
      parseOsc7FromChunk(
        "\x1b]7;file://localhost/first\x07\x1b]7;file://localhost/second\x07\x1b]7;file://localhost/incomplete",
      ),
    ).toBe("/second");
  });

  it("rejects malformed URLs", () => {
    expect(parseOsc7FromChunk("\x1b]7;not a URL\x07")).toBeNull();
  });
});
