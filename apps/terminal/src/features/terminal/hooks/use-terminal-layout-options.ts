import { useEffect, type RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { fitTerminalPreservingScroll } from "@/features/terminal/scroll/fit-terminal-preserving-scroll";

export const useTerminalLayoutOptions = (
  terminalRef: RefObject<Terminal | null>,
  fitAddonRef: RefObject<FitAddon | null>,
  activeFontSize: number,
  activeLineHeight: number,
): void => {
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = activeFontSize;
    terminal.options.lineHeight = activeLineHeight;
    const fitAddon = fitAddonRef.current;
    if (fitAddon) fitTerminalPreservingScroll(terminal, fitAddon);
  }, [activeFontSize, activeLineHeight, terminalRef, fitAddonRef]);
};
