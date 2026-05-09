import { describe, expect, it } from "vite-plus/test";
import { shouldBlockTerminalScrollbackPurge } from "../../src/utils/should-block-terminal-scrollback-purge";

describe("shouldBlockTerminalScrollbackPurge", () => {
  it("handles destructive erase-display scrollback purges", () => {
    expect(shouldBlockTerminalScrollbackPurge([3])).toBe(true);
  });

  it("keeps normal screen clears unhandled", () => {
    expect(shouldBlockTerminalScrollbackPurge([2])).toBe(false);
  });

  it("keeps omitted erase-display parameters unhandled", () => {
    expect(shouldBlockTerminalScrollbackPurge([])).toBe(false);
  });
});
