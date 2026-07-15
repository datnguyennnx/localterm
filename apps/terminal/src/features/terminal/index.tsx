import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { ProgressAddon } from "@xterm/addon-progress";
import { SearchAddon } from "@xterm/addon-search";
import { UnicodeGraphemesAddon } from "@xterm/addon-unicode-graphemes";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COPY_FEEDBACK_MS,
  DISCONNECT_MODAL_THRESHOLD_FAILURES,
  FALLBACK_TERMINAL_BACKGROUND_HEX,
  LOCAL_FONT_ID,
  RECONNECT_DELAY_MS,
  RECONNECT_POLL_INTERVAL_MS,
  RESIZE_DEBOUNCE_MS,
  RESTART_COMMAND,
  RETRY_BUTTON_FEEDBACK_MS,
  TERMINAL_KEYBOARD_HIDE_VIEWPORT_GROWTH_PX,
  TERMINAL_TAP_MOVEMENT_THRESHOLD_PX,
  TERMINAL_VIEWPORT_WIDTH_STABLE_PX,
} from "@/lib/constants";
import type { ServerToClientMessage } from "@datnguyennnx/localterm-server/protocol";
import { findTerminalFontById } from "@/lib/terminal-fonts";
import type { TerminalCursorStyle } from "@/lib/terminal-cursor";
import type { TerminalSessionInfo } from "@/lib/terminal-session-info";
import { findTerminalThemeById } from "@/lib/terminal-themes";
import { chunkInputByCodeUnits } from "@/utils/chunk-input-by-code-units";
import { clampTerminalFontSize } from "@/utils/clamp-terminal-font-size";
import { clampTerminalLineHeight } from "@/utils/clamp-terminal-line-height";
import { formatConnectionLostMarker } from "@/utils/format-connection-lost-marker";
import { formatShellExitMarker } from "@/utils/format-shell-exit-marker";
import { isFindShortcut } from "@/utils/is-find-shortcut";
import { setTabFaviconState } from "@/utils/set-tab-favicon-state";
import { shouldBlockTerminalScrollbackPurge } from "@/utils/should-block-terminal-scrollback-purge";
import {
  loadStoredLocalFontFamily,
  loadStoredTerminalCursorBlink,
  loadStoredTerminalCursorStyle,
  loadStoredTerminalFontId,
  loadStoredTerminalFontSize,
  loadStoredTerminalLineHeight,
  loadStoredTerminalScrollback,
  loadStoredTerminalScrollOnUserInput,
  loadStoredTerminalThemeId,
  storeLocalFontFamily,
  storeTerminalCursorBlink,
  storeTerminalCursorStyle,
  storeTerminalFontId,
  storeTerminalFontSize,
  storeTerminalLineHeight,
  storeTerminalScrollback,
  storeTerminalScrollOnUserInput,
  storeTerminalThemeId,
} from "@/utils/storage-slots";
import {
  MAX_INPUT_BYTES,
  type ClientToServerMessage,
} from "@datnguyennnx/localterm-server/protocol";
import "@xterm/xterm/css/xterm.css";
import type { ExitInfo, TerminalProps } from "./types";
import { buildNewTabUrl, buildWebSocketUrl } from "./types";
import { createFlowController } from "./flow-control";
import { setupKittyKeyboard, attachCustomKeyHandler, attachWheelHandler } from "./keyboard";
import { createScrollManager } from "./scroll";
import { SearchOverlay } from "./search";
import { TerminalDialogs } from "./dialogs";
import { TerminalToolbar } from "./toolbar";
import {
  useAppleWebKitViewport,
  useCwdSync,
  useModalChangeNotification,
  usePlatform,
  useReconnectPolling,
  useSearchFocus,
  useTerminalFont,
  useTerminalLayoutOptions,
  useTerminalVisualOptions,
  useTimerCleanup,
} from "./hooks";

export const Terminal = ({ onModalOpenChange }: TerminalProps = {}) => {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const retryFeedbackTimerRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const isReconnectingRef = useRef(false);
  const openSearchOverlayRef = useRef<(() => void) | null>(null);
  const refocusTerminalRef = useRef<(() => void) | null>(null);
  const liveCwdRef = useRef<string | null>(null);
  const manualReconnectRef = useRef<(() => void) | null>(null);

  // ── Initial values ─────────────────────────────────────────────────────────
  const initialThemeIdRef = useRef<string>(loadStoredTerminalThemeId());
  const initialFontIdRef = useRef<string>(loadStoredTerminalFontId());
  const initialLocalFontFamilyRef = useRef<string | null>(loadStoredLocalFontFamily());
  const initialFontSizeRef = useRef<number>(loadStoredTerminalFontSize());
  const initialLineHeightRef = useRef<number>(loadStoredTerminalLineHeight());
  const initialCursorStyleRef = useRef<TerminalCursorStyle>(loadStoredTerminalCursorStyle());
  const initialCursorBlinkRef = useRef<boolean>(loadStoredTerminalCursorBlink());
  const initialScrollbackRef = useRef<number>(loadStoredTerminalScrollback());
  const initialScrollOnUserInputRef = useRef<boolean>(loadStoredTerminalScrollOnUserInput());

  // ── State ──────────────────────────────────────────────────────────────────
  const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [hasCopiedRestartCommand, setHasCopiedRestartCommand] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchOpenAttempt, setSearchOpenAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ resultIndex: -1, resultCount: 0 });
  const [activeThemeId, setActiveThemeId] = useState<string>(initialThemeIdRef.current);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [activeFontId, setActiveFontId] = useState<string>(initialFontIdRef.current);
  const [activeLocalFontFamily, setActiveLocalFontFamily] = useState<string | null>(
    initialLocalFontFamilyRef.current,
  );
  const [previewFontId, setPreviewFontId] = useState<string | null>(null);
  const [activeFontSize, setActiveFontSize] = useState<number>(initialFontSizeRef.current);
  const [activeLineHeight, setActiveLineHeight] = useState<number>(initialLineHeightRef.current);
  const [activeCursorStyle, setActiveCursorStyle] = useState<TerminalCursorStyle>(
    initialCursorStyleRef.current,
  );
  const [previewCursorStyle, setPreviewCursorStyle] = useState<TerminalCursorStyle | null>(null);
  const [activeCursorBlink, setActiveCursorBlink] = useState<boolean>(
    initialCursorBlinkRef.current,
  );
  const [activeScrollback, setActiveScrollback] = useState<number>(initialScrollbackRef.current);
  const [activeScrollOnUserInput, setActiveScrollOnUserInput] = useState<boolean>(
    initialScrollOnUserInputRef.current,
  );
  const [sessionInfo, setSessionInfo] = useState<TerminalSessionInfo | null>(null);
  const [liveCwd, setLiveCwd] = useState<string | null>(null);

  // ── Platform ───────────────────────────────────────────────────────────────
  const { isMac, isTouchDevice, isAppleWebKit } = usePlatform();
  useAppleWebKitViewport(rootRef, isTouchDevice, isAppleWebKit);

  // ── Computed values ────────────────────────────────────────────────────────
  const effectiveThemeId = previewThemeId ?? activeThemeId;
  const effectiveTheme = useMemo(() => findTerminalThemeById(effectiveThemeId), [effectiveThemeId]);
  const effectiveFontId = previewFontId ?? activeFontId;
  const effectiveFont = useMemo(
    () => findTerminalFontById(effectiveFontId, activeLocalFontFamily),
    [effectiveFontId, activeLocalFontFamily],
  );
  const effectiveCursorStyle = previewCursorStyle ?? activeCursorStyle;
  const pageBackground = effectiveTheme.colors.background ?? FALLBACK_TERMINAL_BACKGROUND_HEX;
  const newTabUrl = useMemo(() => buildNewTabUrl(liveCwd), [liveCwd]);

  // ── Main lifecycle effect ──────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let exited = false;
    let lastTitle = "";
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let faviconActiveTimer: number | null = null;
    let faviconIdleTimer: number | null = null;
    let faviconState: "idle" | "active" = "idle";
    let abortTouchController = new AbortController();
    let wasEverConnected = false;

    const send = (message: ClientToServerMessage): void => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };

    const noteOutputActivity = () => {
      if (faviconIdleTimer !== null) {
        window.clearTimeout(faviconIdleTimer);
        faviconIdleTimer = null;
      }
      if (faviconState === "idle" && faviconActiveTimer === null) {
        faviconActiveTimer = window.setTimeout(() => {
          faviconActiveTimer = null;
          if (disposed || exited) return;
          faviconState = "active";
          setTabFaviconState("active");
        }, 250);
      }
      faviconIdleTimer = window.setTimeout(() => {
        faviconIdleTimer = null;
        if (faviconActiveTimer !== null) {
          window.clearTimeout(faviconActiveTimer);
          faviconActiveTimer = null;
        }
        if (faviconState === "active") {
          faviconState = "idle";
          setTabFaviconState("idle");
        }
      }, 750);
    };

    const resetFavicon = () => {
      if (faviconActiveTimer !== null) {
        window.clearTimeout(faviconActiveTimer);
        faviconActiveTimer = null;
      }
      if (faviconIdleTimer !== null) {
        window.clearTimeout(faviconIdleTimer);
        faviconIdleTimer = null;
      }
      if (faviconState === "active") {
        faviconState = "idle";
        setTabFaviconState("idle");
      }
    };

    const initialFont = findTerminalFontById(
      initialFontIdRef.current,
      initialLocalFontFamilyRef.current,
    );

    const terminal = new XtermTerminal({
      allowProposedApi: true,
      cursorBlink: initialCursorBlinkRef.current,
      cursorStyle: initialCursorStyleRef.current,
      fontFamily: initialFont.family,
      fontSize: initialFontSizeRef.current,
      lineHeight: initialLineHeightRef.current,
      scrollback: initialScrollbackRef.current,
      theme: findTerminalThemeById(initialThemeIdRef.current).colors,
      macOptionIsMeta: true,
      scrollOnUserInput: initialScrollOnUserInputRef.current,
    });
    terminalRef.current = terminal;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new ClipboardAddon());
    terminal.loadAddon(new ImageAddon());
    terminal.loadAddon(new ProgressAddon());
    terminal.loadAddon(new UnicodeGraphemesAddon());

    const searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;
    const searchResultsDisposable = searchAddon.onDidChangeResults(setSearchResults);

    terminal.open(container);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        if (webglAddonRef.current === webglAddon) webglAddonRef.current = null;
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
      webglAddonRef.current = webglAddon;
    } catch {
      webglAddonRef.current = null;
    }

    const helperTextArea = terminal.textarea;
    if (helperTextArea) {
      helperTextArea.autocomplete = "off";
      helperTextArea.setAttribute("autocapitalize", "off");
      helperTextArea.setAttribute("autocorrect", "off");
      helperTextArea.spellcheck = false;
    }

    // Touch handling
    let tapStartClientX = 0;
    let tapStartClientY = 0;
    let didTapMoveBeyondThreshold = false;
    const focusTerminalForInput = () => {
      if (terminal.textarea) terminal.textarea.inputMode = "";
      terminal.focus();
    };
    const refocusTerminalQuietly = () => {
      if (isTouchDevice && terminal.textarea) terminal.textarea.inputMode = "none";
      terminal.focus();
    };
    refocusTerminalRef.current = refocusTerminalQuietly;

    if (isTouchDevice) {
      const signal = abortTouchController.signal;
      const guardTextarea = () => {
        if (terminal.textarea) terminal.textarea.inputMode = "none";
      };
      const blurAndGuardTextarea = () => {
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
        const handleViewportResize = () => {
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

    // Kitty keyboard protocol
    const kittyKeyboard = setupKittyKeyboard(terminal);

    // Scrollback purge protection
    terminal.parser.registerCsiHandler({ final: "J" }, shouldBlockTerminalScrollbackPurge);
    terminal.parser.registerCsiHandler(
      { prefix: "?", final: "J" },
      shouldBlockTerminalScrollbackPurge,
    );

    // Scroll manager
    const scrollManager = createScrollManager({
      terminal,
      fitAddon,
      sendResize: (cols, rows) => send({ type: "resize", cols, rows }),
      resizeDebounceMs: RESIZE_DEBOUNCE_MS,
    });

    // Flow controller
    const flowController = createFlowController({
      terminalWrite: (data, cb) => terminal.write(data, cb),
      sendFlowPause: () => send({ type: "flow-pause" }),
      sendFlowResume: () => send({ type: "flow-resume" }),
      captureScrollAnchor: () => scrollManager.captureAnchor(),
      restoreScrollAnchor: (anchor) => scrollManager.restoreAnchor(anchor),
      hasScrollRestore: () => scrollManager.hasResizeRestore(),
      restoreScrollFromResize: () => scrollManager.restoreResizeScroll(),
      isExited: () => exited,
    });

    // Keyboard handlers
    attachCustomKeyHandler(terminal, {
      isMac,
      getKittyFlags: () => kittyKeyboard.getFlags(),
      openFindOverlay: () => openSearchOverlayRef.current?.(),
      sendInput: (data) => send({ type: "input", data }),
      isTouchDevice,
    });
    attachWheelHandler(terminal);

    // Title handler
    const titleDisposable = terminal.onTitleChange((rawTitle: string) => {
      if (exited) return;
      const trimmed = rawTitle.trim();
      if (!trimmed) return;
      lastTitle = trimmed;
      document.title = trimmed || "localterm";
    });

    // Input + resize
    terminal.onData((data) => {
      for (const chunk of chunkInputByCodeUnits(data, MAX_INPUT_BYTES)) {
        send({ type: "input", data: chunk });
      }
    });
    terminal.onResize(({ cols, rows }) => send({ type: "resize", cols, rows }));

    const observer = new ResizeObserver(() => scrollManager.scheduleFit());
    observer.observe(container);
    scrollManager.fitToContainer();
    refocusTerminalQuietly();

    // ── WebSocket lifecycle ──────────────────────────────────────────────────
    const markShellDead = (exitCode: number | null) => {
      if (exited) return;
      exited = true;
      resetFavicon();
      setTabFaviconState("dead");
      terminal.write(formatShellExitMarker(exitCode));
      document.title = `† ${lastTitle || "localterm"}`;
      setExitInfo({ reason: "shell-exited", exitCode });
      setSessionInfo(null);
    };

    const markConnectionLost = (closeCode: number, closeReason: string, wasClean: boolean) => {
      if (exited) return;
      exited = true;
      resetFavicon();
      setTabFaviconState("dead");
      terminal.write(formatConnectionLostMarker(closeCode, closeReason));
      document.title = `† ${lastTitle || "localterm"}`;
      setExitInfo({ reason: "connection-lost", closeCode, closeReason, wasClean });
      setSessionInfo(null);
    };

    const connect = () => {
      flowController.clear();
      if (disposed) return;
      const nextSocket = new WebSocket(buildWebSocketUrl(liveCwdRef.current));
      nextSocket.binaryType = "arraybuffer";
      socket = nextSocket;

      nextSocket.addEventListener("open", () => {
        if (disposed || socket !== nextSocket) return;
        wasEverConnected = true;
        setConsecutiveFailures(0);
        send({ type: "resize", cols: terminal.cols, rows: terminal.rows });
        isReconnectingRef.current = false;
      });

      nextSocket.addEventListener("message", (event) => {
        if (disposed || socket !== nextSocket) return;
        if (event.data instanceof ArrayBuffer) {
          flowController.write(new Uint8Array(event.data));
          noteOutputActivity();
          return;
        }
        if (typeof event.data !== "string") return;
        let raw: unknown;
        try {
          raw = JSON.parse(event.data);
        } catch {
          return;
        }
        // Lightweight structural check instead of Zod safeParse
        if (
          typeof raw !== "object" ||
          raw === null ||
          typeof (raw as Record<string, unknown>).type !== "string"
        )
          return;
        const message = raw as ServerToClientMessage;
        if (message.type === "output") {
          flowController.write(message.data);
          noteOutputActivity();
        } else if (message.type === "title") {
          const trimmed = message.title.trim();
          if (!trimmed) return;
          lastTitle = trimmed;
          document.title = trimmed;
        } else if (message.type === "session") {
          setSessionInfo({
            shell: message.shell,
            shellName: message.shellName,
            pid: message.pid,
            cwd: message.cwd,
          });
          setLiveCwd(message.cwd);
        } else if (message.type === "cwd") {
          setLiveCwd(message.cwd);
        } else if (message.type === "exit") {
          resetFavicon();
          markShellDead(message.code);
        }
      });

      nextSocket.addEventListener("close", (event) => {
        if (socket !== nextSocket) return;
        socket = null;
        isReconnectingRef.current = false;
        if (disposed) return;
        if (exited) return;
        if (wasEverConnected) {
          console.warn(
            `[localterm] websocket closed: code=${event.code} reason=${JSON.stringify(event.reason)} wasClean=${event.wasClean}`,
          );
          markConnectionLost(event.code, event.reason, event.wasClean);
          return;
        }
        setConsecutiveFailures((previous) => previous + 1);
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      });

      nextSocket.addEventListener("error", () => {
        console.warn("[localterm] websocket error");
        try {
          nextSocket.close();
        } catch {
          /* socket already closing */
        }
      });
    };

    const manualReconnect = () => {
      if (disposed) return;
      exited = false;
      wasEverConnected = false;
      setExitInfo(null);
      setSessionInfo(null);
      setConsecutiveFailures(0);
      setTabFaviconState("idle");
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        socket?.close();
      } catch {
        /* socket already closing */
      }
      socket = null;
      connect();
    };

    manualReconnectRef.current = manualReconnect;
    connect();

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      disposed = true;
      manualReconnectRef.current = null;
      refocusTerminalRef.current = null;
      openSearchOverlayRef.current = null;
      searchAddonRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      webglAddonRef.current = null;
      titleDisposable.dispose();
      searchResultsDisposable.dispose();
      abortTouchController.abort();
      scrollManager.cleanupResizeScroll();
      resetFavicon();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      observer.disconnect();
      try {
        socket?.close();
      } catch {
        /* socket already closed */
      }
      socket = null;
      terminal.dispose();
      document.title = "localterm";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Extracted small effects ────────────────────────────────────────────────
  useTerminalLayoutOptions(terminalRef, fitAddonRef, activeFontSize, activeLineHeight);
  useTerminalVisualOptions(
    terminalRef,
    effectiveTheme,
    effectiveCursorStyle,
    activeCursorBlink,
    activeScrollback,
    activeScrollOnUserInput,
  );
  useTerminalFont(terminalRef, fitAddonRef, webglAddonRef, effectiveFont);
  useSearchFocus(isSearchOpen, searchOpenAttempt, searchInputRef);
  useTimerCleanup(retryFeedbackTimerRef, copyFeedbackTimerRef);

  // Live cwd ref sync
  useEffect(() => {
    liveCwdRef.current = liveCwd;
  }, [liveCwd]);
  useCwdSync(liveCwd);

  // ── Callback handlers ──────────────────────────────────────────────────────
  const handleThemeChange = useCallback((nextThemeId: string) => {
    setActiveThemeId(nextThemeId);
    setPreviewThemeId(null);
    storeTerminalThemeId(nextThemeId);
  }, []);

  const handleFontChange = useCallback((nextFontId: string) => {
    setActiveFontId(nextFontId);
    setPreviewFontId(null);
    storeTerminalFontId(nextFontId);
  }, []);

  const handleLocalFontChange = useCallback((family: string) => {
    setActiveLocalFontFamily(family);
    setActiveFontId(LOCAL_FONT_ID);
    setPreviewFontId(null);
    storeLocalFontFamily(family);
    storeTerminalFontId(LOCAL_FONT_ID);
  }, []);

  const handleFontSizeChange = useCallback((nextFontSize: number) => {
    const clamped = clampTerminalFontSize(nextFontSize);
    setActiveFontSize(clamped);
    storeTerminalFontSize(clamped);
  }, []);

  const handleLineHeightChange = useCallback((nextLineHeight: number) => {
    const clamped = clampTerminalLineHeight(nextLineHeight);
    setActiveLineHeight(clamped);
    storeTerminalLineHeight(clamped);
  }, []);

  const handleCursorStyleChange = useCallback((nextCursorStyle: TerminalCursorStyle) => {
    setActiveCursorStyle(nextCursorStyle);
    setPreviewCursorStyle(null);
    storeTerminalCursorStyle(nextCursorStyle);
  }, []);

  const handleCursorBlinkChange = useCallback((nextCursorBlink: boolean) => {
    setActiveCursorBlink(nextCursorBlink);
    storeTerminalCursorBlink(nextCursorBlink);
  }, []);

  const handleScrollbackChange = useCallback((nextScrollback: number) => {
    setActiveScrollback(nextScrollback);
    storeTerminalScrollback(nextScrollback);
  }, []);

  const handleScrollOnUserInputChange = useCallback((nextScrollOnUserInput: boolean) => {
    setActiveScrollOnUserInput(nextScrollOnUserInput);
    storeTerminalScrollOnUserInput(nextScrollOnUserInput);
  }, []);

  // ── Search handlers ────────────────────────────────────────────────────────
  const findNextMatch = useCallback((query: string) => {
    if (!query) {
      searchAddonRef.current?.clearDecorations();
      setSearchResults({ resultIndex: -1, resultCount: 0 });
      return;
    }
    searchAddonRef.current?.findNext(query);
  }, []);

  const findPreviousMatch = useCallback((query: string) => {
    if (!query) return;
    searchAddonRef.current?.findPrevious(query);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults({ resultIndex: -1, resultCount: 0 });
    searchAddonRef.current?.clearDecorations();
    refocusTerminalRef.current?.();
  }, []);

  const openSearchOverlay = useCallback(() => {
    setIsSearchOpen(true);
    setSearchOpenAttempt((previous) => previous + 1);
  }, []);
  openSearchOverlayRef.current = openSearchOverlay;

  const handleSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setSearchQuery(next);
      findNextMatch(next);
    },
    [findNextMatch],
  );

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (isFindShortcut(event.nativeEvent, isMac)) {
        event.preventDefault();
        event.currentTarget.select();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          findPreviousMatch(searchQuery);
        } else {
          findNextMatch(searchQuery);
        }
      }
    },
    [closeSearch, findNextMatch, findPreviousMatch, isMac, searchQuery],
  );

  // ── Reconnect handlers ─────────────────────────────────────────────────────
  const triggerManualReconnect = useCallback(() => {
    if (isReconnectingRef.current) return;
    isReconnectingRef.current = true;
    setIsRetryingConnection(true);
    manualReconnectRef.current?.();
    if (retryFeedbackTimerRef.current !== null) {
      window.clearTimeout(retryFeedbackTimerRef.current);
    }
    retryFeedbackTimerRef.current = window.setTimeout(() => {
      retryFeedbackTimerRef.current = null;
      setIsRetryingConnection(false);
    }, RETRY_BUTTON_FEEDBACK_MS);
  }, []);

  const copyRestartCommand = useCallback(() => {
    void navigator.clipboard
      .writeText(RESTART_COMMAND)
      .then(() => {
        setHasCopiedRestartCommand(true);
        if (copyFeedbackTimerRef.current !== null) {
          window.clearTimeout(copyFeedbackTimerRef.current);
        }
        copyFeedbackTimerRef.current = window.setTimeout(() => {
          copyFeedbackTimerRef.current = null;
          setHasCopiedRestartCommand(false);
        }, COPY_FEEDBACK_MS);
      })
      .catch(() => {
        /* clipboard permission denied */
      });
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isSessionOver = exitInfo !== null;
  const isDisconnected =
    !isSessionOver && consecutiveFailures >= DISCONNECT_MODAL_THRESHOLD_FAILURES;
  const isModalOpen = isSessionOver || isDisconnected;
  const isConnectionLost = exitInfo !== null && exitInfo.reason !== "shell-exited";

  useReconnectPolling(isConnectionLost, triggerManualReconnect, RECONNECT_POLL_INTERVAL_MS);
  useModalChangeNotification(isModalOpen, onModalOpenChange);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      ref={rootRef}
      className="h-dvh w-dvw pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
      style={{ background: pageBackground }}
    >
      <div className="relative h-full w-full">
        <div ref={containerRef} aria-label="terminal session" className="absolute inset-0" />
        {isSessionOver && exitInfo ? (
          <span
            role="status"
            aria-live="polite"
            className="absolute top-2 left-3 z-10 inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400"
          >
            {exitInfo.reason === "shell-exited"
              ? exitInfo.exitCode === null
                ? "exited"
                : `exited · code ${exitInfo.exitCode}`
              : `disconnected · code ${exitInfo.closeCode}`}
          </span>
        ) : null}
        <TerminalToolbar
          activeThemeId={activeThemeId}
          onThemeChange={handleThemeChange}
          onThemePreview={setPreviewThemeId}
          activeFontId={activeFontId}
          onFontChange={handleFontChange}
          onFontPreview={setPreviewFontId}
          activeLocalFontFamily={activeLocalFontFamily}
          onLocalFontChange={handleLocalFontChange}
          activeFontSize={activeFontSize}
          onFontSizeChange={handleFontSizeChange}
          activeLineHeight={activeLineHeight}
          onLineHeightChange={handleLineHeightChange}
          activeCursorStyle={activeCursorStyle}
          onCursorStyleChange={handleCursorStyleChange}
          onCursorStylePreview={setPreviewCursorStyle}
          activeCursorBlink={activeCursorBlink}
          onCursorBlinkChange={handleCursorBlinkChange}
          activeScrollback={activeScrollback}
          onScrollbackChange={handleScrollbackChange}
          activeScrollOnUserInput={activeScrollOnUserInput}
          onScrollOnUserInputChange={handleScrollOnUserInputChange}
          sessionInfo={sessionInfo}
          newTabUrl={newTabUrl}
          onOpenSearch={openSearchOverlay}
          isMac={isMac}
          isSearchOpen={isSearchOpen}
        />
        <SearchOverlay
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          searchResults={searchResults}
          onSearchChange={handleSearchInputChange}
          onKeyDown={handleSearchKeyDown}
          onFindNext={() => findNextMatch(searchQuery)}
          onFindPrevious={() => findPreviousMatch(searchQuery)}
        />
      </div>
      <TerminalDialogs
        isModalOpen={isModalOpen}
        exitInfo={exitInfo}
        isRetryingConnection={isRetryingConnection}
        hasCopiedRestartCommand={hasCopiedRestartCommand}
        newTabUrl={newTabUrl}
        onReconnect={triggerManualReconnect}
        onCopyRestartCommand={copyRestartCommand}
      />
    </main>
  );
};
