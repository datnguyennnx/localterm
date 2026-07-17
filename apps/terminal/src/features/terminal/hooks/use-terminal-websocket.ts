import { useCallback, useEffect, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import { setTabFaviconState } from "@/features/terminal/favicon/set-tab-favicon-state";
import { formatConnectionLostMarker } from "@/features/terminal/messages/format-connection-lost-marker";
import { formatShellExitMarker } from "@/features/terminal/messages/format-shell-exit-marker";
import type {
  ServerToClientMessage,
  ClientToServerMessage,
} from "@datnguyennnx/localterm-server/protocol";
import { buildWebSocketUrl } from "@/features/terminal/types";
import {
  COPY_FEEDBACK_MS,
  RECONNECT_DELAY_MS,
  RESTART_COMMAND,
  RETRY_BUTTON_FEEDBACK_MS,
} from "@/lib/constants";
import type { ExitInfo } from "@/features/terminal/types";
import type { TerminalSessionInfo } from "@/features/terminal/session/terminal-session-info";
import type { TerminalCursorStyle } from "@/features/terminal/cursor/terminal-cursor";
import type { FlowController } from "@/features/terminal/flow-control";

export interface UseTerminalWebSocketParams {
  terminalRef: React.RefObject<Terminal | null>;
  flowControllerRef: React.RefObject<FlowController | null>;
  exitedRef: React.RefObject<boolean>;
  lastTitleRef: React.RefObject<string>;
  resetFaviconRef: React.RefObject<(() => void) | null>;
  noteOutputActivityRef: React.RefObject<(() => void) | null>;
  liveCwdRef: React.RefObject<string | null>;
  isReconnectingRef: React.RefObject<boolean>;
  retryFeedbackTimerRef: React.RefObject<number | null>;
  copyFeedbackTimerRef: React.RefObject<number | null>;
  setExitInfo: (info: ExitInfo | null) => void;
  setSessionInfo: (info: TerminalSessionInfo | null) => void;
  setConsecutiveFailures: React.Dispatch<React.SetStateAction<number>>;
  setHasCopiedRestartCommand: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRetryingConnection: React.Dispatch<React.SetStateAction<boolean>>;
  setLiveCwd: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveThemeId: (id: string) => void;
  setActiveFontId: (id: string) => void;
  setActiveLocalFontFamily: (family: string | null) => void;
  setActiveFontSize: (size: number) => void;
  setActiveLineHeight: (height: number) => void;
  setActiveCursorStyle: React.Dispatch<React.SetStateAction<TerminalCursorStyle>>;
  setActiveCursorBlink: (blink: boolean) => void;
  setActiveScrollback: (scrollback: number) => void;
  setActiveScrollOnUserInput: (scrollOnInput: boolean) => void;
  initialThemeIdRef: React.RefObject<string>;
  initialFontIdRef: React.RefObject<string>;
  initialLocalFontFamilyRef: React.RefObject<string | null>;
  initialFontSizeRef: React.RefObject<number>;
  initialLineHeightRef: React.RefObject<number>;
  initialCursorStyleRef: React.RefObject<string>;
  initialCursorBlinkRef: React.RefObject<boolean>;
  initialScrollbackRef: React.RefObject<number>;
  initialScrollOnUserInputRef: React.RefObject<boolean>;
}

export interface UseTerminalWebSocketReturn {
  send: (message: ClientToServerMessage) => void;
  triggerManualReconnect: () => void;
  copyRestartCommand: () => void;
}

export const useTerminalWebSocket = ({
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
}: UseTerminalWebSocketParams): UseTerminalWebSocketReturn => {
  const socketRef = useRef<WebSocket | null>(null);
  const manualReconnectFnRef = useRef<(() => void) | null>(null);

  const send = useCallback((message: ClientToServerMessage): void => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let wasEverConnected = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      flowControllerRef.current?.clear();
      if (disposed) return;
      const nextSocket = new WebSocket(buildWebSocketUrl(liveCwdRef.current));
      nextSocket.binaryType = "arraybuffer";
      socketRef.current = nextSocket;

      nextSocket.addEventListener("open", () => {
        if (disposed || socketRef.current !== nextSocket) return;
        wasEverConnected = true;
        setConsecutiveFailures(0);
        if (terminalRef.current) {
          send({
            type: "resize",
            cols: terminalRef.current.cols,
            rows: terminalRef.current.rows,
          });
        }
        isReconnectingRef.current = false;
      });

      nextSocket.addEventListener("message", (event) => {
        if (disposed || socketRef.current !== nextSocket) return;
        if (event.data instanceof ArrayBuffer) {
          flowControllerRef.current?.write(new Uint8Array(event.data));
          noteOutputActivityRef.current?.();
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
          flowControllerRef.current?.write(message.data);
          noteOutputActivityRef.current?.();
        } else if (message.type === "title") {
          const trimmed = message.title.trim();
          if (!trimmed) return;
          lastTitleRef.current = trimmed;
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
          resetFaviconRef.current?.();
          markShellDead(message.code);
        }
      });

      nextSocket.addEventListener("close", (event) => {
        if (socketRef.current !== nextSocket) return;
        socketRef.current = null;
        isReconnectingRef.current = false;
        if (disposed) return;
        if (exitedRef.current) return;
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

    const markShellDead = (exitCode: number | null) => {
      if (exitedRef.current) return;
      exitedRef.current = true;
      resetFaviconRef.current?.();
      setTabFaviconState("dead");
      terminalRef.current?.write(formatShellExitMarker(exitCode));
      document.title = `† ${lastTitleRef.current || "localterm"}`;
      setExitInfo({ reason: "shell-exited", exitCode });
      setSessionInfo(null);
    };

    const markConnectionLost = (closeCode: number, closeReason: string, wasClean: boolean) => {
      if (exitedRef.current) return;
      exitedRef.current = true;
      resetFaviconRef.current?.();
      setTabFaviconState("dead");
      terminalRef.current?.write(formatConnectionLostMarker(closeCode, closeReason));
      document.title = `† ${lastTitleRef.current || "localterm"}`;
      setExitInfo({
        reason: "connection-lost",
        closeCode,
        closeReason,
        wasClean,
      });
      setSessionInfo(null);
    };

    const manualReconnect = () => {
      if (disposed) return;
      exitedRef.current = false;
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
        socketRef.current?.close();
      } catch {
        /* socket already closing */
      }
      socketRef.current = null;
      connect();
    };

    manualReconnectFnRef.current = manualReconnect;
    connect();

    return () => {
      disposed = true;
      manualReconnectFnRef.current = null;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      try {
        socketRef.current?.close();
      } catch {
        /* socket already closed */
      }
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerManualReconnect = useCallback(() => {
    if (isReconnectingRef.current) return;
    isReconnectingRef.current = true;
    setIsRetryingConnection(true);
    manualReconnectFnRef.current?.();
    if (retryFeedbackTimerRef.current !== null) {
      window.clearTimeout(retryFeedbackTimerRef.current);
    }
    retryFeedbackTimerRef.current = window.setTimeout(() => {
      retryFeedbackTimerRef.current = null;
      setIsRetryingConnection(false);
    }, RETRY_BUTTON_FEEDBACK_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { send, triggerManualReconnect, copyRestartCommand };
};
