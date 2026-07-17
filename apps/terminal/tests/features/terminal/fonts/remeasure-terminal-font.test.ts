import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";
import { describe, expect, it, vi } from "vite-plus/test";
import { remeasureTerminalFont } from "../../../../src/features/terminal/fonts/remeasure-terminal-font";

describe("remeasureTerminalFont", () => {
  it("invalidates xterm metrics and the WebGL atlas before refitting", () => {
    const assignedFontFamilies: string[] = [];
    const options = {
      set fontFamily(fontFamily: string) {
        assignedFontFamilies.push(fontFamily);
      },
    };
    const terminal = {
      buffer: { active: { baseY: 0, viewportY: 0 } },
      options,
      scrollToBottom: vi.fn(),
      scrollLines: vi.fn(),
    } as unknown as Terminal;
    const fit = vi.fn();
    const fitAddon = { fit } as unknown as FitAddon;
    const clearTextureAtlas = vi.fn();
    const webglAddon = { clearTextureAtlas } as unknown as WebglAddon;

    remeasureTerminalFont(terminal, fitAddon, webglAddon, '"Geist Mono", monospace');

    expect(assignedFontFamilies).toEqual(["", '"Geist Mono", monospace']);
    expect(clearTextureAtlas).toHaveBeenCalledTimes(2);
    expect(fit).toHaveBeenCalledOnce();
  });
});
