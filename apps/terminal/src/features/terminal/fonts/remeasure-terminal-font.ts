import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";
import { fitTerminalPreservingScroll } from "../scroll/fit-terminal-preserving-scroll";

export const remeasureTerminalFont = (
  terminal: Terminal,
  fitAddon: FitAddon,
  webglAddon: WebglAddon | null,
  fontFamily: string,
): void => {
  webglAddon?.clearTextureAtlas();
  terminal.options.fontFamily = "";
  terminal.options.fontFamily = fontFamily;
  fitTerminalPreservingScroll(terminal, fitAddon);
  webglAddon?.clearTextureAtlas();
};
