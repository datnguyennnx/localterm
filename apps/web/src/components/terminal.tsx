import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { ProgressAddon } from "@xterm/addon-progress";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import { Check, ChevronDown, ChevronUp, Copy, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemePicker } from "@/components/theme-picker";
import {
  COPY_FEEDBACK_MS,
  DEAD_SESSION_TITLE_PREFIX,
  DEFAULT_DOCUMENT_TITLE,
  DISCONNECT_MODAL_THRESHOLD_FAILURES,
  FAVICON_ACTIVE_DEBOUNCE_MS,
  FAVICON_IDLE_DEBOUNCE_MS,
  FALLBACK_TERMINAL_BACKGROUND_HEX,
  RECONNECT_DELAY_MS,
  RESIZE_DEBOUNCE_MS,
  RESTART_COMMAND,
  RETRY_BUTTON_FEEDBACK_MS,
  SEARCH_ACTIVE_MATCH_BACKGROUND_HEX,
  SEARCH_ACTIVE_MATCH_BORDER_HEX,
  SEARCH_MATCH_BACKGROUND_HEX,
  TERMINAL_FONT_SIZE_PX,
  TERMINAL_LINE_HEIGHT,
  TERMINAL_SCROLLBACK_LINES,
} from "@/lib/constants";
import { serverToClientMessageSchema } from "@/lib/schemas";
import { findTerminalThemeById } from "@/lib/terminal-themes";
import type { ClientToServerMessage } from "@/lib/types";
import { detectIsMacPlatform } from "@/utils/detect-is-mac-platform";
import { isFindShortcut } from "@/utils/is-find-shortcut";
import { loadStoredTerminalThemeId } from "@/utils/load-stored-terminal-theme-id";
import { storeTerminalThemeId } from "@/utils/store-terminal-theme-id";
import { setTabFaviconState } from "@/utils/tab-favicon";
import "@xterm/xterm/css/xterm.css";

const formatExitMarker = (code: number | null): string => {
  const description = code === null ? "shell exited" : `shell exited with code ${code}`;
  return `\r\n\x1b[2;31m[${description}]\x1b[0m\r\n`;
};

const titleForLiveSession = (raw: string): string => raw || DEFAULT_DOCUMENT_TITLE;
const titleForDeadSession = (raw: string): string =>
  `${DEAD_SESSION_TITLE_PREFIX}${raw || DEFAULT_DOCUMENT_TITLE}`;

const SEARCH_DECORATION_OPTIONS = {
  matchBackground: SEARCH_MATCH_BACKGROUND_HEX,
  activeMatchBackground: SEARCH_ACTIVE_MATCH_BACKGROUND_HEX,
  activeMatchBorder: SEARCH_ACTIVE_MATCH_BORDER_HEX,
  matchOverviewRuler: SEARCH_ACTIVE_MATCH_BACKGROUND_HEX,
  activeMatchColorOverviewRuler: SEARCH_ACTIVE_MATCH_BORDER_HEX,
};

const FALLBACK_MONO_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const resolveMonoFontFamily = (): string => {
  if (typeof window === "undefined") return FALLBACK_MONO_FONT_FAMILY;
  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim();
  return value || FALLBACK_MONO_FONT_FAMILY;
};

const buildWebSocketUrl = (): string => {
  const url = new URL("/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

const openNewShellInNewTab = () => {
  window.open(window.location.origin, "_blank", "noopener,noreferrer");
};

interface SearchResultState {
  resultIndex: number;
  resultCount: number;
}

interface TerminalProps {
  onModalOpenChange?: (open: boolean) => void;
}

export const Terminal = ({ onModalOpenChange }: TerminalProps = {}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const manualReconnectRef = useRef<(() => void) | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const refocusTerminalRef = useRef<(() => void) | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const retryFeedbackTimerRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const initialThemeIdRef = useRef<string>(loadStoredTerminalThemeId());
  const [exitInfo, setExitInfo] = useState<{ code: number | null } | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [hasCopiedRestartCommand, setHasCopiedRestartCommand] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchOpenAttempt, setSearchOpenAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultState>({
    resultIndex: -1,
    resultCount: 0,
  });
  const [activeThemeId, setActiveThemeId] = useState<string>(initialThemeIdRef.current);
  const activeTheme = useMemo(() => findTerminalThemeById(activeThemeId), [activeThemeId]);
  const isMac = useMemo(detectIsMacPlatform, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let exited = false;
    let wasEverConnected = false;
    let lastTitle = "";
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let resizeTimer: number | null = null;
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
          if (disposed || exited) return;
          faviconState = "active";
          setTabFaviconState("active");
        }, FAVICON_ACTIVE_DEBOUNCE_MS);
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
      }, FAVICON_IDLE_DEBOUNCE_MS);
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

    void document.fonts.load(`${TERMINAL_FONT_SIZE_PX}px "Geist Mono"`).catch(() => {});

    const terminal = new XtermTerminal({
      allowProposedApi: true,
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: resolveMonoFontFamily(),
      fontSize: TERMINAL_FONT_SIZE_PX,
      lineHeight: TERMINAL_LINE_HEIGHT,
      scrollback: TERMINAL_SCROLLBACK_LINES,
      theme: findTerminalThemeById(initialThemeIdRef.current).colors,
      macOptionIsMeta: true,
      scrollOnUserInput: true,
    });
    terminalRef.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new ClipboardAddon());
    terminal.loadAddon(new ImageAddon());
    terminal.loadAddon(new ProgressAddon());
    const unicode11 = new Unicode11Addon();
    terminal.loadAddon(unicode11);
    terminal.unicode.activeVersion = "11";
    const search = new SearchAddon();
    terminal.loadAddon(search);
    searchAddonRef.current = search;
    const searchResultsDisposable = search.onDidChangeResults(({ resultIndex, resultCount }) => {
      setSearchResults({ resultIndex, resultCount });
    });

    terminal.open(container);
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      terminal.loadAddon(webgl);
    } catch {
      /* webgl unavailable; xterm falls back to canvas */
    }

    const openSearch = () => {
      setIsSearchOpen(true);
      setSearchOpenAttempt((previous) => previous + 1);
    };

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.key === "Tab" && (event.metaKey || event.ctrlKey)) return false;
      if (isFindShortcut(event, isMac)) {
        if (event.type === "keydown") {
          event.preventDefault();
          openSearch();
        }
        return false;
      }
      return true;
    });

    const applyIncomingTitle = (rawTitle: string) => {
      const trimmed = rawTitle.trim();
      if (!trimmed) return;
      lastTitle = trimmed;
      if (!exited) document.title = titleForLiveSession(trimmed);
    };

    const titleDisposable = terminal.onTitleChange(applyIncomingTitle);

    refocusTerminalRef.current = () => terminal.focus();

    const send = (message: ClientToServerMessage) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };

    const sendResize = (cols: number, rows: number) => send({ type: "resize", cols, rows });

    const fitToContainer = () => {
      try {
        fit.fit();
        sendResize(terminal.cols, terminal.rows);
      } catch {
        /* container not yet measured */
      }
    };

    const scheduleFit = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        fitToContainer();
      }, RESIZE_DEBOUNCE_MS);
    };

    terminal.onData((data) => send({ type: "input", data }));
    terminal.onResize(({ cols, rows }) => sendResize(cols, rows));

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(container);
    fitToContainer();
    terminal.focus();

    const markShellDead = (code: number | null) => {
      if (exited) return;
      exited = true;
      resetFavicon();
      setTabFaviconState("dead");
      terminal.write(formatExitMarker(code));
      document.title = titleForDeadSession(lastTitle);
      setExitInfo({ code });
    };

    const connect = () => {
      if (disposed) return;
      const nextSocket = new WebSocket(buildWebSocketUrl());
      socket = nextSocket;

      nextSocket.addEventListener("open", () => {
        if (disposed || socket !== nextSocket) return;
        wasEverConnected = true;
        setConsecutiveFailures(0);
        sendResize(terminal.cols, terminal.rows);
      });

      nextSocket.addEventListener("message", (event) => {
        if (disposed || socket !== nextSocket) return;
        let raw: unknown;
        try {
          raw = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
        } catch {
          return;
        }
        const parsed = serverToClientMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        const message = parsed.data;
        if (message.type === "output") {
          terminal.write(message.data);
          noteOutputActivity();
        } else if (message.type === "title") {
          applyIncomingTitle(message.title);
        } else if (message.type === "exit") {
          resetFavicon();
          markShellDead(message.code);
        }
      });

      nextSocket.addEventListener("close", () => {
        if (socket === nextSocket) socket = null;
        if (disposed) return;
        if (exited) return;
        if (wasEverConnected) {
          markShellDead(null);
          return;
        }
        setConsecutiveFailures((previous) => previous + 1);
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      });

      nextSocket.addEventListener("error", () => {
        try {
          nextSocket.close();
        } catch {
          /* socket already closing */
        }
      });
    };

    manualReconnectRef.current = () => {
      if (disposed || exited) return;
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

    connect();

    return () => {
      disposed = true;
      manualReconnectRef.current = null;
      refocusTerminalRef.current = null;
      searchAddonRef.current = null;
      terminalRef.current = null;
      titleDisposable.dispose();
      searchResultsDisposable.dispose();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resetFavicon();
      observer.disconnect();
      try {
        socket?.close();
      } catch {
        /* socket already closed */
      }
      socket = null;
      terminal.dispose();
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = activeTheme.colors;
  }, [activeTheme]);

  const handleThemeChange = useCallback((nextThemeId: string) => {
    setActiveThemeId(nextThemeId);
    storeTerminalThemeId(nextThemeId);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    const input = searchInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isSearchOpen, searchOpenAttempt]);

  const findNextMatch = useCallback((query: string) => {
    if (!query) {
      searchAddonRef.current?.clearDecorations();
      setSearchResults({ resultIndex: -1, resultCount: 0 });
      return;
    }
    searchAddonRef.current?.findNext(query, { decorations: SEARCH_DECORATION_OPTIONS });
  }, []);

  const findPreviousMatch = useCallback((query: string) => {
    if (!query) return;
    searchAddonRef.current?.findPrevious(query, { decorations: SEARCH_DECORATION_OPTIONS });
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

  const triggerManualReconnect = useCallback(() => {
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
        /* clipboard permission denied; user can still select + copy manually */
      });
  }, []);

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
  }, []);

  const isShellDead = exitInfo !== null;
  const isDisconnected = !isShellDead && consecutiveFailures >= DISCONNECT_MODAL_THRESHOLD_FAILURES;
  const isModalOpen = isShellDead || isDisconnected;

  useEffect(() => {
    onModalOpenChange?.(isModalOpen);
  }, [isModalOpen, onModalOpenChange]);
  const matchLabel =
    searchResults.resultCount === 0
      ? "0/0"
      : `${searchResults.resultIndex + 1}/${searchResults.resultCount}`;

  const pageBackground = activeTheme.colors.background ?? FALLBACK_TERMINAL_BACKGROUND_HEX;

  return (
    <div className="h-dvh w-dvw" style={{ background: pageBackground }}>
      <div className="relative h-full w-full">
        <div ref={containerRef} aria-label="terminal session" className="absolute inset-0" />
        {isShellDead ? (
          <Badge
            variant="destructive"
            role="status"
            aria-live="polite"
            className="absolute top-2 left-3 z-10"
          >
            {exitInfo?.code === null ? "exited" : `exited · code ${exitInfo?.code}`}
          </Badge>
        ) : null}
        {isSearchOpen ? null : (
          <div
            role="toolbar"
            aria-label="terminal actions"
            className="absolute top-2 right-3 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-background/70 p-0.5 text-muted-foreground shadow-xs backdrop-blur-md"
          >
            <ThemePicker value={activeThemeId} onValueChange={handleThemeChange} />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={openSearchOverlay}
                    aria-label="find in terminal"
                    className="hover:text-foreground"
                  />
                }
              >
                <Search />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                Find {isMac ? "(\u2318F)" : "(Ctrl+F)"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="open a new shell in a new browser tab"
                    render={<a href="/" target="_blank" rel="noopener noreferrer" />}
                    className="hover:text-foreground"
                  />
                }
              >
                <Plus />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                New shell (new tab)
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        {isSearchOpen ? (
          <InputGroup
            role="search"
            aria-label="find in terminal"
            className="absolute top-2 right-3 z-10 w-80 border-border/60 bg-background/70 text-muted-foreground shadow-xs backdrop-blur-md dark:bg-background/70"
          >
            <InputGroupInput
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Find"
              aria-label="find query"
              className="text-xs"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText
                role="status"
                aria-label="match count"
                className="text-xs tabular-nums"
              >
                {matchLabel}
              </InputGroupText>
              <InputGroupButton
                size="icon-xs"
                onClick={() => findPreviousMatch(searchQuery)}
                disabled={searchResults.resultCount === 0}
                aria-label="previous match"
              >
                <ChevronUp />
              </InputGroupButton>
              <InputGroupButton
                size="icon-xs"
                onClick={() => findNextMatch(searchQuery)}
                disabled={searchResults.resultCount === 0}
                aria-label="next match"
              >
                <ChevronDown />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        ) : null}
      </div>

      <AlertDialog open={isModalOpen}>
        <AlertDialogContent>
          {isShellDead ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Shell ended</AlertDialogTitle>
                <AlertDialogDescription>
                  {exitInfo?.code === null || exitInfo?.code === 0
                    ? "Open a new shell to keep going, or close this tab."
                    : `Exit code ${exitInfo?.code}. Open a new shell to keep going.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={openNewShellInNewTab}>New shell</AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Spinner aria-hidden="true" role="presentation" aria-label={undefined} />
                  Lost connection
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The localterm server isn't responding. Start it again from your terminal, then
                  retry.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <InputGroup>
                <InputGroupInput
                  readOnly
                  value={RESTART_COMMAND}
                  aria-label="restart command"
                  className="font-mono"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={copyRestartCommand}
                    aria-label={hasCopiedRestartCommand ? "Copied" : "Copy restart command"}
                  >
                    {hasCopiedRestartCommand ? <Check /> : <Copy />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <AlertDialogFooter>
                <AlertDialogAction onClick={triggerManualReconnect} disabled={isRetryingConnection}>
                  {isRetryingConnection ? <Spinner data-icon="inline-start" /> : null}
                  Retry
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
