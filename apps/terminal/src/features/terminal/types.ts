import type { TerminalScrollAnchor } from "@/features/terminal/scroll/capture-terminal-scroll-anchor";

export const FLOW_CALLBACK_BYTE_LIMIT = 131072;
export const FLOW_HIGH_WATER_CALLBACKS = 4;
export const FLOW_LOW_WATER_CALLBACKS = 1;

export const estimateBytes = (data: string | Uint8Array): number =>
  typeof data === "string" ? data.length : data.byteLength;

const CWD_QUERY_PARAM = "cwd";

export const buildWebSocketUrl = (
  cwdOverride?: string | null,
  sessionId?: string | null,
): string => {
  const url = new URL("/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const cwd = cwdOverride ?? new URLSearchParams(window.location.search).get(CWD_QUERY_PARAM);
  if (cwd) url.searchParams.set(CWD_QUERY_PARAM, cwd);
  if (sessionId) url.searchParams.set("sessionId", sessionId);
  return url.toString();
};

export const buildNewTabUrl = (cwd: string | null): string => {
  const url = new URL(window.location.origin);
  if (cwd) url.searchParams.set(CWD_QUERY_PARAM, cwd);
  return url.toString();
};

export interface SearchResultState {
  resultIndex: number;
  resultCount: number;
}

export type ExitInfo =
  | { reason: "shell-exited"; exitCode: number | null }
  | {
      reason: "connection-lost";
      closeCode: number;
      closeReason: string;
      wasClean: boolean;
    };

export interface TerminalProps {
  onModalOpenChange?: (open: boolean) => void;
}

export interface ResizeScrollRestoreState {
  anchor: TerminalScrollAnchor;
  timer: number;
}
