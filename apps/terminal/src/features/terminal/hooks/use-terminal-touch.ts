import { useEffect, type RefObject } from "react";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import {
  TERMINAL_KEYBOARD_HIDE_VIEWPORT_GROWTH_PX,
  TERMINAL_TAP_MOVEMENT_THRESHOLD_PX,
  TERMINAL_VIEWPORT_WIDTH_STABLE_PX,
} from "@/lib/constants";

export const useTerminalTouch = (
  terminalRef: RefObject<XtermTerminal | null>,
  isTouchDevice: boolean,
  refocusTerminalRef: RefObject<(() => void) | null>,
): void => {
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    let tapStartClientX = 0;
    let tapStartClientY = 0;
    let didTapMoveBeyondThreshold = false;

    const abortController = new AbortController();

    const focusTerminalForInput = (): void => {
      if (terminal.textarea) terminal.textarea.inputMode = "";
      terminal.focus();
    };

    const refocusTerminalQuietly = (): void => {
      if (isTouchDevice && terminal.textarea) terminal.textarea.inputMode = "none";
      terminal.focus();
    };
    refocusTerminalRef.current = refocusTerminalQuietly;

    if (isTouchDevice) {
      const signal = abortController.signal;

      const guardTextarea = (): void => {
        if (terminal.textarea) terminal.textarea.inputMode = "none";
      };
      const blurAndGuardTextarea = (): void => {
        if (!terminal.textarea) return;
        terminal.textarea.blur();
        terminal.textarea.inputMode = "none";
      };
      guardTextarea();
      terminal.textarea?.addEventListener("blur", guardTextarea, { signal });

      const visualViewport = window.visualViewport;
      if (visualViewport) {
        let previousViewportHeight = visualViewport.height;
        let previousViewportWidth = visualViewport.width;
        const handleViewportResize = (): void => {
          const height = visualViewport.height;
          const width = visualViewport.width;
          const didViewportGrow =
            height > previousViewportHeight + TERMINAL_KEYBOARD_HIDE_VIEWPORT_GROWTH_PX;
          const didViewportWidthStayStable =
            Math.abs(width - previousViewportWidth) < TERMINAL_VIEWPORT_WIDTH_STABLE_PX;
          if (didViewportGrow && didViewportWidthStayStable) blurAndGuardTextarea();
          previousViewportHeight = height;
          previousViewportWidth = width;
        };
        visualViewport.addEventListener("resize", handleViewportResize, { signal });
      }

      terminal.element?.addEventListener(
        "touchstart",
        (event: TouchEvent) => {
          if (event.touches.length !== 1) {
            didTapMoveBeyondThreshold = true;
            return;
          }
          tapStartClientX = event.touches[0].clientX;
          tapStartClientY = event.touches[0].clientY;
          didTapMoveBeyondThreshold = false;
        },
        { capture: true, passive: true, signal },
      );
      terminal.element?.addEventListener(
        "touchmove",
        (event: TouchEvent) => {
          if (event.touches.length !== 1) {
            didTapMoveBeyondThreshold = true;
            return;
          }
          const movedPx = Math.hypot(
            event.touches[0].clientX - tapStartClientX,
            event.touches[0].clientY - tapStartClientY,
          );
          if (movedPx > TERMINAL_TAP_MOVEMENT_THRESHOLD_PX) {
            didTapMoveBeyondThreshold = true;
          }
        },
        { capture: true, passive: true, signal },
      );
      terminal.element?.addEventListener(
        "touchend",
        (event: TouchEvent) => {
          if (didTapMoveBeyondThreshold) {
            event.preventDefault();
            return;
          }
          focusTerminalForInput();
        },
        { capture: true, passive: false, signal },
      );
    }

    // Initial refocus to match original behavior
    refocusTerminalQuietly();

    return () => {
      abortController.abort();
      refocusTerminalRef.current = null;
    };
  }, [terminalRef, isTouchDevice, refocusTerminalRef]);
};
