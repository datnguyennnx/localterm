import { describe, expect, it } from "vite-plus/test";
import { stripAnsi } from "../../src/parser/strip-ansi.js";

describe("stripAnsi", () => {
  it("passes through plain text unchanged", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  it("strips SGR color codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("strips multiple SGR params", () => {
    expect(stripAnsi("\x1b[1;32mbold green\x1b[0m")).toBe("bold green");
  });

  it("strips cursor movement sequences", () => {
    expect(stripAnsi("\x1b[10A\x1b[5Cmove")).toBe("move");
  });

  it("strips erase display/line sequences", () => {
    expect(stripAnsi("\x1b[2J\x1b[Hclear")).toBe("clear");
  });

  it("strips OSC escape sequences (window title, etc.)", () => {
    expect(stripAnsi("\x1b]0;my title\x07text")).toBe("text");
    expect(stripAnsi("\x1b]2;tab title\x1b\\more text")).toBe("more text");
  });

  it("strips simple ESC sequences", () => {
    expect(stripAnsi("\x1b7\x1b8save")).toBe("save");
  });

  it("preserves newlines and tabs", () => {
    expect(stripAnsi("line1\n\tline2\nline3")).toBe("line1\n\tline2\nline3");
  });

  it("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("strips mixed ANSI sequences", () => {
    const input = "\x1b[36mINFO\x1b[0m \x1b[2m16:30\x1b[0m building...\n\x1b[32m✓\x1b[0m done";
    expect(stripAnsi(input)).toBe("INFO 16:30 building...\n✓ done");
  });
});
