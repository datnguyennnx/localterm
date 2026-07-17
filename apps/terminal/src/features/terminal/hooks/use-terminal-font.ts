import { useEffect, type RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";
import { awaitFontReady } from "@/features/terminal/fonts/await-font-ready";
import type { TerminalFont } from "@/features/terminal/fonts/terminal-fonts";
import { remeasureTerminalFont } from "@/features/terminal/fonts/remeasure-terminal-font";

export const useTerminalFont = (
  terminalRef: RefObject<Terminal | null>,
  fitAddonRef: RefObject<FitAddon | null>,
  webglAddonRef: RefObject<WebglAddon | null>,
  effectiveFont: TerminalFont,
): void => {
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    let cancelled = false;
    void awaitFontReady(effectiveFont).then(() => {
      if (cancelled) return;
      const liveTerminal = terminalRef.current;
      if (!liveTerminal) return;
      const liveFitAddon = fitAddonRef.current;
      if (!liveFitAddon) return;
      remeasureTerminalFont(
        liveTerminal,
        liveFitAddon,
        webglAddonRef.current,
        effectiveFont.family,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveFont, terminalRef, fitAddonRef, webglAddonRef]);
};
