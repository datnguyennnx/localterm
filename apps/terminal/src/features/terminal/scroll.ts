import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { TerminalScrollAnchor } from "@/utils/capture-terminal-scroll-anchor";
import { captureTerminalScrollAnchor } from "@/utils/capture-terminal-scroll-anchor";
import { restoreTerminalScrollAnchor } from "@/utils/restore-terminal-scroll-anchor";
import { fitTerminalPreservingScroll } from "@/utils/fit-terminal-preserving-scroll";
import { RESIZE_SCROLL_RESTORE_WINDOW_MS } from "@/lib/constants";
import type { ResizeScrollRestoreState } from "./types";

export interface ScrollManager {
  captureAnchor: () => TerminalScrollAnchor;
  restoreAnchor: (anchor: TerminalScrollAnchor) => void;
  fitToContainer: () => void;
  scheduleFit: () => void;
  beginResizeScrollRestore: (anchor: TerminalScrollAnchor) => void;
  clearResizeScrollRestore: () => void;
  restoreResizeScroll: () => void;
  hasResizeRestore: () => boolean;
  cleanupResizeScroll: () => void;
}

export interface ScrollManagerDeps {
  terminal: Terminal;
  fitAddon: FitAddon;
  sendResize: (cols: number, rows: number) => void;
  resizeDebounceMs: number;
}

export const createScrollManager = (deps: ScrollManagerDeps): ScrollManager => {
  let resizeTimer: number | null = null;
  let resizeScrollAnimationFrame: number | null = null;
  let restoreState: ResizeScrollRestoreState | null = null;

  const captureAnchor = (): TerminalScrollAnchor => captureTerminalScrollAnchor(deps.terminal);

  const restoreAnchor = (anchor: TerminalScrollAnchor): void => {
    restoreTerminalScrollAnchor(deps.terminal, anchor);
  };

  const clearResizeScrollRestore = (): void => {
    if (restoreState) window.clearTimeout(restoreState.timer);
    if (resizeScrollAnimationFrame !== null) {
      window.cancelAnimationFrame(resizeScrollAnimationFrame);
      resizeScrollAnimationFrame = null;
    }
    restoreState = null;
  };

  const restoreResizeScroll = (): void => {
    if (!restoreState) return;
    restoreAnchor(restoreState.anchor);
  };

  const beginResizeScrollRestore = (anchor: TerminalScrollAnchor): void => {
    clearResizeScrollRestore();
    const timer = window.setTimeout(() => {
      restoreResizeScroll();
      restoreState = null;
    }, RESIZE_SCROLL_RESTORE_WINDOW_MS);
    restoreState = {
      anchor,
      timer,
    };
    resizeScrollAnimationFrame = window.requestAnimationFrame(() => {
      resizeScrollAnimationFrame = null;
      restoreResizeScroll();
    });
  };

  const fitToContainer = (): void => {
    const scrollAnchor = captureAnchor();
    if (!fitTerminalPreservingScroll(deps.terminal, deps.fitAddon)) return;
    beginResizeScrollRestore(scrollAnchor);
  };

  const scheduleFit = (): void => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null;
      fitToContainer();
    }, deps.resizeDebounceMs);
  };

  const hasResizeRestore = (): boolean => restoreState !== null;

  const cleanupResizeScroll = (): void => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    clearResizeScrollRestore();
  };

  return {
    captureAnchor,
    restoreAnchor,
    fitToContainer,
    scheduleFit,
    beginResizeScrollRestore,
    clearResizeScrollRestore,
    restoreResizeScroll,
    hasResizeRestore,
    cleanupResizeScroll,
  };
};
