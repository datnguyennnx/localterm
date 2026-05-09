import type {
  TerminalScrollAnchor,
  TerminalScrollAnchorSource,
} from "@/utils/capture-terminal-scroll-anchor";

export interface TerminalScrollAnchorRestorer extends TerminalScrollAnchorSource {
  scrollLines: (amount: number) => void;
  scrollToBottom: () => void;
}

export const restoreTerminalScrollAnchor = (
  terminal: TerminalScrollAnchorRestorer,
  anchor: TerminalScrollAnchor,
): void => {
  if (anchor.wasAtBottom) {
    terminal.scrollToBottom();
    return;
  }

  const buffer = terminal.buffer.active;
  const targetViewportY = Math.max(0, buffer.baseY - anchor.distanceFromBottom);
  const lineDelta = targetViewportY - buffer.viewportY;
  if (lineDelta !== 0) terminal.scrollLines(lineDelta);
};
