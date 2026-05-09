import type { Terminal as XtermTerminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { shouldBlockTerminalScrollbackPurge } from "../../src/utils/should-block-terminal-scrollback-purge";

interface XtermScrollbackSnapshot {
  baseY: number;
  length: number;
  type: string;
  viewportY: number;
}

const writeTerminal = (terminal: XtermTerminal, data: string): Promise<void> =>
  new Promise((resolve) => terminal.write(data, resolve));

const writeTerminalChunks = async (
  terminal: XtermTerminal,
  chunks: readonly string[],
): Promise<void> => {
  for (const chunk of chunks) await writeTerminal(terminal, chunk);
};

const createTerminal = async () => {
  const { Terminal } = await import("@xterm/xterm");
  return new Terminal({ cols: 10, rows: 3, scrollback: 100 });
};

const fillScrollback = async (terminal: XtermTerminal): Promise<void> => {
  await writeTerminal(terminal, "1\r\n2\r\n3\r\n4\r\n5");
};

const captureScrollback = (terminal: XtermTerminal): XtermScrollbackSnapshot => ({
  baseY: terminal.buffer.active.baseY,
  length: terminal.buffer.active.length,
  type: terminal.buffer.active.type,
  viewportY: terminal.buffer.active.viewportY,
});

const registerScrollbackPurgeBlockers = (terminal: XtermTerminal): void => {
  terminal.parser.registerCsiHandler({ final: "J" }, shouldBlockTerminalScrollbackPurge);
  terminal.parser.registerCsiHandler(
    { prefix: "?", final: "J" },
    shouldBlockTerminalScrollbackPurge,
  );
};

describe("xterm scrollback purge handling", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reproduces xterm's default ED3 scrollback deletion", async () => {
    const terminal = await createTerminal();
    await fillScrollback(terminal);

    const before = captureScrollback(terminal);
    await writeTerminal(terminal, "\x1b[3J");
    const after = captureScrollback(terminal);

    expect(before.baseY).toBeGreaterThan(0);
    expect(before.length).toBeGreaterThan(terminal.rows);
    expect(after.baseY).toBe(0);
    expect(after.viewportY).toBe(0);
    expect(after.length).toBe(terminal.rows);
  });

  it("blocks ED3 encodings that xterm normalizes through CSI handlers", async () => {
    const purgeSequences = [
      ["\x1b[3J"],
      ["\x1b[03J"],
      ["\u009b3J"],
      ["\x1b[?3J"],
      ["\x1b[3;0J"],
      ["\x1b[3:0J"],
      ["\x1b[", "3", "J"],
      ["\x1b[?", "3", "J"],
    ];

    for (const purgeSequence of purgeSequences) {
      const terminal = await createTerminal();
      registerScrollbackPurgeBlockers(terminal);
      await fillScrollback(terminal);

      const before = captureScrollback(terminal);
      await writeTerminalChunks(terminal, purgeSequence);
      const after = captureScrollback(terminal);

      expect(after).toEqual(before);
    }
  });

  it("allows visible clears and alt-buffer switches without deleting normal scrollback", async () => {
    const terminal = await createTerminal();
    registerScrollbackPurgeBlockers(terminal);
    await fillScrollback(terminal);

    const before = captureScrollback(terminal);
    await writeTerminal(terminal, "\x1b[2J");
    expect(captureScrollback(terminal)).toEqual(before);

    await writeTerminal(terminal, "\x1b[?1049h");
    expect(terminal.buffer.active.type).toBe("alternate");
    expect(terminal.buffer.normal.baseY).toBe(before.baseY);
    expect(terminal.buffer.normal.length).toBe(before.length);

    await writeTerminal(terminal, "\x1b[?1049l");
    expect(captureScrollback(terminal)).toEqual(before);
  });

  it("does not over-block other buffer-mutating control sequences", async () => {
    const preservedNormalScrollbackSequences = [
      "\x1b[0J",
      "\x1b[1J",
      "\x1b[2J",
      "\x1b[!p",
      "\x1b[1S",
      "\x1b[1T",
      "\x1b[1L",
      "\x1b[1M",
    ];

    for (const sequence of preservedNormalScrollbackSequences) {
      const terminal = await createTerminal();
      registerScrollbackPurgeBlockers(terminal);
      await fillScrollback(terminal);

      const before = captureScrollback(terminal);
      await writeTerminal(terminal, sequence);

      expect(captureScrollback(terminal)).toEqual(before);
    }
  });

  it("leaves full terminal reset behavior intact", async () => {
    const terminal = await createTerminal();
    registerScrollbackPurgeBlockers(terminal);
    await fillScrollback(terminal);

    await writeTerminal(terminal, "\x1bc");
    const after = captureScrollback(terminal);

    expect(after.baseY).toBe(0);
    expect(after.viewportY).toBe(0);
    expect(after.length).toBe(terminal.rows);
  });
});
