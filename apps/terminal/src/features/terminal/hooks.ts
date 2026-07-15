import { useEffect, useMemo, type RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";
import { awaitFontReady } from "@/utils/await-font-ready";
import { remeasureTerminalFont } from "@/utils/remeasure-terminal-font";
import { fitTerminalPreservingScroll } from "@/utils/fit-terminal-preserving-scroll";
import { syncAppleWebKitViewport } from "@/utils/sync-apple-webkit-viewport";
import { isCoarsePointer } from "@/utils/is-coarse-pointer";
import { detectIsAppleWebKit } from "@/utils/detect-is-apple-webkit";
import { detectIsMacPlatform } from "@/utils/detect-is-mac-platform";
import type { TerminalCursorStyle } from "@/lib/terminal-cursor";
import type { TerminalFont } from "@/lib/terminal-fonts";
import type { TerminalTheme } from "@/lib/terminal-themes";

// ── Platform detection ────────────────────────────────────────────────────────

export const usePlatform = () => {
  const isMac = useMemo(detectIsMacPlatform, []);
  const isTouchDevice = useMemo(isCoarsePointer, []);
  const isAppleWebKit = useMemo(detectIsAppleWebKit, []);
  return { isMac, isTouchDevice, isAppleWebKit };
};

// ── Apple WebKit viewport sync ───────────────────────────────────────────────

export const useAppleWebKitViewport = (
  rootRef: RefObject<HTMLDivElement | null>,
  isTouchDevice: boolean,
  isAppleWebKit: boolean,
): void => {
  useEffect(() => {
    if (!isTouchDevice || !isAppleWebKit) return;
    const root = rootRef.current;
    const visualViewport = window.visualViewport;
    if (!root || !visualViewport) return;
    return syncAppleWebKitViewport(root, visualViewport);
  }, [isTouchDevice, isAppleWebKit, rootRef]);
};

// ── Layout-affecting options (fontSize + lineHeight) ─────────────────────────

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

// ── Visual-only options (theme, cursor, scrollback) ──────────────────────────

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
  }, [effectiveTheme, effectiveCursorStyle, activeCursorBlink, activeScrollback, activeScrollOnUserInput, terminalRef]);
};

// ── Font loading effect ──────────────────────────────────────────────────────

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

// ── Timer cleanup effect ─────────────────────────────────────────────────────

export const useTimerCleanup = (
  retryFeedbackTimerRef: RefObject<number | null>,
  copyFeedbackTimerRef: RefObject<number | null>,
): void => {
  useEffect(() => {
    return () => {
      if (retryFeedbackTimerRef.current !== null) {
        window.clearTimeout(retryFeedbackTimerRef.current);
        retryFeedbackTimerRef.current = null;
      }
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = null;
      }
    };
  }, [retryFeedbackTimerRef, copyFeedbackTimerRef]);
};

// ── CWD sync ─────────────────────────────────────────────────────────────────

export const useCwdSync = (liveCwd: string | null): void => {
  useEffect(() => {
    if (!liveCwd) return;
    const url = new URL(window.location.href);
    url.searchParams.set("cwd", liveCwd);
    window.history.replaceState(null, "", url);
  }, [liveCwd]);
};

// ── Search focus effect ──────────────────────────────────────────────────────

export const useSearchFocus = (
  isSearchOpen: boolean,
  searchOpenAttempt: number,
  searchInputRef: RefObject<HTMLInputElement | null>,
): void => {
  useEffect(() => {
    if (!isSearchOpen) return;
    const input = searchInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isSearchOpen, searchOpenAttempt, searchInputRef]);
};

// ── Reconnect polling ────────────────────────────────────────────────────────

export const useReconnectPolling = (
  isConnectionLost: boolean,
  triggerManualReconnect: () => void,
  pollIntervalMs: number,
): void => {
  useEffect(() => {
    if (!isConnectionLost) return;
    const intervalId = window.setInterval(() => {
      triggerManualReconnect();
    }, pollIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [isConnectionLost, triggerManualReconnect, pollIntervalMs]);
};

// ── Modal open change notification ───────────────────────────────────────────

export const useModalChangeNotification = (
  isModalOpen: boolean,
  onModalOpenChange?: (open: boolean) => void,
): void => {
  useEffect(() => {
    onModalOpenChange?.(isModalOpen);
  }, [isModalOpen, onModalOpenChange]);
};
