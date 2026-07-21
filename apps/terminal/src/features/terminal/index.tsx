import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { ProgressAddon } from "@xterm/addon-progress";
import { SearchAddon } from "@xterm/addon-search";
import { UnicodeGraphemesAddon } from "@xterm/addon-unicode-graphemes";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import {
  DISCONNECT_MODAL_THRESHOLD_FAILURES,
  FALLBACK_TERMINAL_BACKGROUND_HEX,
  RECONNECT_POLL_INTERVAL_MS,
  RESIZE_DEBOUNCE_MS,
} from "@/lib/constants";
import { findTerminalFontById } from "@/features/terminal/fonts/terminal-fonts";
import type { TerminalSessionInfo } from "@/features/terminal/session/terminal-session-info";
import { findTerminalThemeById } from "@/features/terminal/theme/terminal-themes";
import { chunkInputByCodeUnits } from "@/features/terminal/keyboard/chunk-input-by-code-units";
import { setTabFaviconState } from "@/features/terminal/favicon/set-tab-favicon-state";
import { shouldBlockTerminalScrollbackPurge } from "@/features/terminal/scrollback/should-block-terminal-scrollback-purge";
import { MAX_INPUT_BYTES } from "@datnguyennnx/localterm-server/protocol";
import "@xterm/xterm/css/xterm.css";
import type { ExitInfo, TerminalProps } from "./types";
import { createFlowController } from "./flow-control";
import type { FlowController } from "./flow-control";
import {
  setupKittyKeyboard,
  attachCustomKeyHandler,
  attachWheelHandler,
} from "./keyboard/keyboard";
import { createScrollManager } from "./scroll/scroll";
import { SearchOverlay } from "./search";
import { TerminalDialogs } from "./dialogs";
import { TerminalToolbar } from "./toolbar";
import { TerminalExitBadge } from "./index/exit-badge";
import {
  useAppleWebKitViewport,
  useCwdSync,
  useModalChangeNotification,
  usePlatform,
  useReconnectPolling,
  useSearchFocus,
  useTerminalFont,
  useTerminalLayoutOptions,
  useTerminalPreferences,
  useTerminalTouch,
  useTerminalVisualOptions,
  useSearch,
  useTerminalWebSocket,
  useTimerCleanup,
} from "./hooks";

export const Terminal = ({ onModalOpenChange }: TerminalProps = {}) => {
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
  const refocusTerminalRef = useRef<(() => void) | null>(null);
  const liveCwdRef = useRef<string | null>(null);
  const exitedRef = useRef(false);
  const lastTitleRef = useRef("");
  const resetFaviconRef = useRef<(() => void) | null>(null);
  const flowControllerRef = useRef<FlowController | null>(null);
  const noteOutputActivityRef = useRef<(() => void) | null>(null);

  const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [hasCopiedRestartCommand, setHasCopiedRestartCommand] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<TerminalSessionInfo | null>(null);
  const [liveCwd, setLiveCwd] = useState<string | null>(null);

  const {
    initialThemeIdRef,
    initialFontIdRef,
    initialLocalFontFamilyRef,
    initialFontSizeRef,
    initialLineHeightRef,
    initialCursorStyleRef,
    initialCursorBlinkRef,
    initialScrollbackRef,
    initialScrollOnUserInputRef,
    activeThemeId,
    setActiveThemeId,
    activeFontId,
    setActiveFontId,
    activeLocalFontFamily,
    setActiveLocalFontFamily,
    activeFontSize,
    setActiveFontSize,
    activeLineHeight,
    setActiveLineHeight,
    activeCursorStyle,
    setActiveCursorStyle,
    previewCursorStyle,
    activeCursorBlink,
    setActiveCursorBlink,
    activeScrollback,
    setActiveScrollback,
    activeScrollOnUserInput,
    setActiveScrollOnUserInput,
    effectiveTheme,
    effectiveFont,
    newTabUrl,
    handleThemeChange,
    handlePreviewTheme,
    handleFontChange,
    handlePreviewFont,
    handleLocalFontChange,
    handleFontSizeChange,
    handleLineHeightChange,
    handleCursorStyleChange,
    handlePreviewCursor,
    handleCursorBlinkChange,
    handleScrollbackChange,
    handleScrollOnUserInputChange,
    activePaddingX, activePaddingY,
    activeOuterPaddingX, activeOuterPaddingY,
  } = useTerminalPreferences(terminalRef, fitAddonRef, liveCwd);

  const { isMac, isTouchDevice, isAppleWebKit } = usePlatform();
  useAppleWebKitViewport(rootRef, isTouchDevice, isAppleWebKit);
  useTerminalTouch(terminalRef, isTouchDevice, refocusTerminalRef);

  const {
    isSearchOpen,
    searchOpenAttempt,
    searchQuery,
    searchResults,
    setSearchResults,
    openSearchOverlay,
    handleSearchInputChange,
    handleSearchKeyDown,
    findNextMatch,
    findPreviousMatch,
    openSearchOverlayRef,
  } = useSearch(searchAddonRef, refocusTerminalRef, isMac);

  const effectiveCursorStyle = previewCursorStyle ?? activeCursorStyle;
  const pageBackground = effectiveTheme.colors.background ?? FALLBACK_TERMINAL_BACKGROUND_HEX;

  const { send, triggerManualReconnect, copyRestartCommand } = useTerminalWebSocket({
    terminalRef,
    flowControllerRef,
    exitedRef,
    lastTitleRef,
    resetFaviconRef,
    noteOutputActivityRef,
    liveCwdRef,
    isReconnectingRef,
    retryFeedbackTimerRef,
    copyFeedbackTimerRef,
    setExitInfo,
    setSessionInfo,
    setConsecutiveFailures,
    setHasCopiedRestartCommand,
    setIsRetryingConnection,
    setLiveCwd,
    setActiveThemeId,
    setActiveFontId,
    setActiveLocalFontFamily,
    setActiveFontSize,
    setActiveLineHeight,
    setActiveCursorStyle,
    setActiveCursorBlink,
    setActiveScrollback,
    setActiveScrollOnUserInput,
    initialThemeIdRef,
    initialFontIdRef,
    initialLocalFontFamilyRef,
    initialFontSizeRef,
    initialLineHeightRef,
    initialCursorStyleRef,
    initialCursorBlinkRef,
    initialScrollbackRef,
    initialScrollOnUserInputRef,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    exitedRef.current = false;
    lastTitleRef.current = "";
    let faviconActiveTimer: number | null = null;
    let faviconIdleTimer: number | null = null;
    let faviconState: "idle" | "active" = "idle";

    const noteOutputActivity = () => {
      if (faviconIdleTimer !== null) {
        window.clearTimeout(faviconIdleTimer);
        faviconIdleTimer = null;
      }
      if (faviconState === "idle" && faviconActiveTimer === null) {
        faviconActiveTimer = window.setTimeout(() => {
          faviconActiveTimer = null;
          if (disposed || exitedRef.current) return;
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
    noteOutputActivityRef.current = noteOutputActivity;

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
    resetFaviconRef.current = resetFavicon;

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
      isExited: () => exitedRef.current,
    });
    flowControllerRef.current = flowController;

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
      if (exitedRef.current) return;
      const trimmed = rawTitle.trim();
      if (!trimmed) return;
      lastTitleRef.current = trimmed;
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

    return () => {
      disposed = true;
      refocusTerminalRef.current = null;
      openSearchOverlayRef.current = null;
      searchAddonRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      webglAddonRef.current = null;
      titleDisposable.dispose();
      searchResultsDisposable.dispose();
      scrollManager.cleanupResizeScroll();
      resetFavicon();
      observer.disconnect();
      terminal.dispose();
      document.title = "localterm";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTerminalLayoutOptions(terminalRef, fitAddonRef, activeFontSize, activeLineHeight, activePaddingX, activePaddingY);
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

  const isSessionOver = exitInfo !== null;
  const isDisconnected =
    !isSessionOver && consecutiveFailures >= DISCONNECT_MODAL_THRESHOLD_FAILURES;
  const isModalOpen = isSessionOver || isDisconnected;
  const isConnectionLost = exitInfo !== null && exitInfo.reason !== "shell-exited";

  useReconnectPolling(isConnectionLost, triggerManualReconnect, RECONNECT_POLL_INTERVAL_MS);
  useModalChangeNotification(isModalOpen, onModalOpenChange);

  return (
    <main
      ref={rootRef}
      className="h-screen w-dvw"
      style={{
        background: pageBackground,
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${activeOuterPaddingY}px)`,
        paddingRight: `calc(env(safe-area-inset-right, 0px) + ${activeOuterPaddingX}px)`,
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${activeOuterPaddingY}px)`,
        paddingLeft: `calc(env(safe-area-inset-left, 0px) + ${activeOuterPaddingX}px)`,
      }}
    >
      <div className="relative h-full w-full border rounded-lg overflow-hidden bg-background" data-terminal-container>
        <div ref={containerRef} aria-label="terminal session" className="absolute inset-0" style={{
          paddingTop: `${activePaddingY}px`,
          paddingRight: `${activePaddingX}px`,
          paddingBottom: `${activePaddingY}px`,
          paddingLeft: `${activePaddingX}px`,
        }} />
        <TerminalExitBadge exitInfo={exitInfo} />
        <TerminalToolbar
          activeThemeId={activeThemeId}
          onThemeChange={handleThemeChange}
          onThemePreview={handlePreviewTheme}
          activeFontId={activeFontId}
          onFontChange={handleFontChange}
          onFontPreview={handlePreviewFont}
          activeLocalFontFamily={activeLocalFontFamily}
          onLocalFontChange={handleLocalFontChange}
          activeFontSize={activeFontSize}
          onFontSizeChange={handleFontSizeChange}
          activeLineHeight={activeLineHeight}
          onLineHeightChange={handleLineHeightChange}
          activeCursorStyle={activeCursorStyle}
          onCursorStyleChange={handleCursorStyleChange}
          onCursorStylePreview={handlePreviewCursor}
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
        {isSearchOpen && (
          <SearchOverlay
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            searchResults={searchResults}
            onSearchChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
            onFindNext={() => findNextMatch(searchQuery)}
            onFindPrevious={() => findPreviousMatch(searchQuery)}
            isSearchOpen={isSearchOpen}
          />
        )}
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
