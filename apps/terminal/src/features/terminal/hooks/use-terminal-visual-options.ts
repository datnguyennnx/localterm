import { useEffect, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";
import type { TerminalCursorStyle } from "@/features/terminal/cursor/terminal-cursor";
import type { TerminalTheme } from "@/features/terminal/theme/terminal-themes";

export const useTerminalVisualOptions = (
  terminalRef: RefObject<Terminal | null>,
  effectiveTheme: TerminalTheme,
  effectiveCursorStyle: TerminalCursorStyle,
  activeCursorBlink: boolean,
  activeScrollback: number,
  activeScrollOnUserInput: boolean,
): void => {
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = effectiveTheme.colors;
    terminal.options.cursorStyle = effectiveCursorStyle;
    terminal.options.cursorBlink = activeCursorBlink;
    terminal.options.scrollback = activeScrollback;
    terminal.options.scrollOnUserInput = activeScrollOnUserInput;
  }, [
    effectiveTheme,
    effectiveCursorStyle,
    activeCursorBlink,
    activeScrollback,
    activeScrollOnUserInput,
    terminalRef,
  ]);
};
