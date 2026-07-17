import { describe, expect, it } from "vite-plus/test";
import { formatConnectionLostMarker } from "../../../../src/features/terminal/messages/format-connection-lost-marker";

describe("formatConnectionLostMarker", () => {
  it("formats the marker with the close code and no reason", () => {
    const result = formatConnectionLostMarker(1006, "");
    expect(result).toBe("\r\n\x1b[2;31m[connection lost · code 1006]\x1b[0m\r\n");
  });

  it("includes the close reason when provided", () => {
    const result = formatConnectionLostMarker(1000, "normal closure");
    expect(result).toContain("[connection lost · code 1000 · normal closure]");
  });

  it("handles a zero close code gracefully", () => {
    const result = formatConnectionLostMarker(0, "reason");
    expect(result).toContain("code 0 · reason");
  });

  it("handles a negative close code (defensive edge case)", () => {
    const result = formatConnectionLostMarker(-1, "");
    expect(result).toContain("code -1");
  });

  it("includes ANSI dim red escape sequences", () => {
    const result = formatConnectionLostMarker(1006, "");
    expect(result).toContain("\x1b[2;31m");
    expect(result).toContain("\x1b[0m");
  });

  it("wraps the output with carriage-return-newline before and after", () => {
    const result = formatConnectionLostMarker(1006, "");
    expect(result).toMatch(/^\r\n.*\r\n$/);
  });
});
