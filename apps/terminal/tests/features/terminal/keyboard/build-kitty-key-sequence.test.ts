import { describe, expect, it } from "vite-plus/test";
import { buildKittyKeySequence } from "../../../../src/features/terminal/keyboard/build-kitty-key-sequence";

describe("buildKittyKeySequence", () => {
  it("builds a sequence with no modifiers (modifierBits = 0)", () => {
    expect(buildKittyKeySequence(13, 0)).toBe("\x1b[13;1u");
  });

  it("builds a sequence with shift modifier", () => {
    expect(buildKittyKeySequence(13, 1)).toBe("\x1b[13;2u");
  });

  it("builds a sequence with alt modifier", () => {
    expect(buildKittyKeySequence(65, 2)).toBe("\x1b[65;3u");
  });

  it("builds a sequence with ctrl modifier", () => {
    expect(buildKittyKeySequence(65, 4)).toBe("\x1b[65;5u");
  });

  it("builds a sequence with meta modifier", () => {
    expect(buildKittyKeySequence(65, 8)).toBe("\x1b[65;9u");
  });

  it("builds a sequence with combined modifiers", () => {
    // shift (1) + ctrl (4) = 5
    expect(buildKittyKeySequence(65, 5)).toBe("\x1b[65;6u");
  });

  it("handles keyCode 0 (edge case)", () => {
    expect(buildKittyKeySequence(0, 0)).toBe("\x1b[0;1u");
  });

  it("handles high keyCode values", () => {
    expect(buildKittyKeySequence(999, 15)).toBe("\x1b[999;16u");
  });
});
