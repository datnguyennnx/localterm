import { describe, expect, it } from "vite-plus/test";
import { formatShellExitMarker } from "../../src/utils/format-shell-exit-marker";

describe("formatShellExitMarker", () => {
  it("formats the marker with an exit code", () => {
    const result = formatShellExitMarker(0);
    expect(result).toBe("\r\n\x1b[2;31m[shell exited with code 0]\x1b[0m\r\n");
  });

  it("formats the marker with a non-zero exit code", () => {
    const result = formatShellExitMarker(127);
    expect(result).toContain("[shell exited with code 127]");
  });

  it("formats the marker for null exit code (shell exited without code)", () => {
    const result = formatShellExitMarker(null);
    expect(result).toContain("[shell exited]");
    expect(result).not.toContain("code");
  });

  it("includes ANSI dim red escape sequences", () => {
    const result = formatShellExitMarker(1);
    expect(result).toContain("\x1b[2;31m");
    expect(result).toContain("\x1b[0m");
  });

  it("wraps the output with carriage-return-newline before and after", () => {
    const result = formatShellExitMarker(0);
    expect(result).toMatch(/^\r\n.*\r\n$/);
  });
});
