import { describe, expect, it } from "vite-plus/test";
import { chunkInputByCodeUnits } from "../../src/utils/chunk-input-by-code-units";

describe("chunkInputByCodeUnits", () => {
  it("returns the input as a single chunk when it fits the limit", () => {
    expect(chunkInputByCodeUnits("hello", 10)).toEqual(["hello"]);
  });

  it("returns the input as a single chunk when length matches the limit exactly", () => {
    expect(chunkInputByCodeUnits("abcdef", 6)).toEqual(["abcdef"]);
  });

  it("splits oversized input into chunks no larger than the limit", () => {
    const oversized = "a".repeat(25);
    const chunks = chunkInputByCodeUnits(oversized, 10);
    expect(chunks).toEqual(["a".repeat(10), "a".repeat(10), "a".repeat(5)]);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(10);
  });

  it("never splits a UTF-16 surrogate pair", () => {
    const supplementaryChar = "\uD83D\uDE00";
    const data = `aaaa${supplementaryChar}bbbb`;
    const chunks = chunkInputByCodeUnits(data, 5);
    expect(chunks.join("")).toBe(data);
    for (const chunk of chunks) {
      const lastCodeUnit = chunk.charCodeAt(chunk.length - 1);
      expect(lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff).toBe(false);
    }
  });

  it("preserves the joined output exactly", () => {
    const data = `${"x".repeat(64 * 1024)}\nmore content here\n${"y".repeat(200_000)}`;
    const chunks = chunkInputByCodeUnits(data, 64 * 1024);
    expect(chunks.join("")).toBe(data);
  });

  it("handles empty input", () => {
    expect(chunkInputByCodeUnits("", 10)).toEqual([""]);
  });
});
