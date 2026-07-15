import type { TerminalScrollAnchor } from "@/utils/capture-terminal-scroll-anchor";

// ── Flow control ──────────────────────────────────────────────────────────────

export const FLOW_CALLBACK_BYTE_LIMIT = 131072;
export const FLOW_HIGH_WATER_CALLBACKS = 4;
export const FLOW_LOW_WATER_CALLBACKS = 1;

export const estimateBytes = (data: string | Uint8Array): number =>
  typeof data === "string" ? data.length : data.byteLength;

// ── Session helpers ───────────────────────────────────────────────────────────

import { DEAD_SESSION_TITLE_PREFIX, DEFAULT_DOCUMENT_TITLE } from "@/lib/constants";

export const titleForLiveSession = (raw: string): string => raw || DEFAULT_DOCUMENT_TITLE;

export const titleForDeadSession = (raw: string): string =>
  `${DEAD_SESSION_TITLE_PREFIX}${raw || DEFAULT_DOCUMENT_TITLE}`;

export const CWD_QUERY_PARAM = "cwd";

// ── Search ────────────────────────────────────────────────────────────────────

import {
  SEARCH_ACTIVE_MATCH_BACKGROUND_HEX,
  SEARCH_ACTIVE_MATCH_BORDER_HEX,
  SEARCH_MATCH_BACKGROUND_HEX,
} from "@/lib/constants";

export const SEARCH_DECORATION_OPTIONS = {
  matchBackground: SEARCH_MATCH_BACKGROUND_HEX,
  activeMatchBackground: SEARCH_ACTIVE_MATCH_BACKGROUND_HEX,
  activeMatchBorder: SEARCH_ACTIVE_MATCH_BORDER_HEX,
  matchOverviewRuler: SEARCH_ACTIVE_MATCH_BACKGROUND_HEX,
  activeMatchColorOverviewRuler: SEARCH_ACTIVE_MATCH_BORDER_HEX,
};

// ── URL builders ──────────────────────────────────────────────────────────────

export const buildWebSocketUrl = (cwdOverride?: string | null): string => {
  const url = new URL("/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const cwd = cwdOverride ?? new URLSearchParams(window.location.search).get(CWD_QUERY_PARAM);
  if (cwd) url.searchParams.set(CWD_QUERY_PARAM, cwd);
  return url.toString();
};

export const buildNewTabUrl = (cwd: string | null): string => {
  const url = new URL(window.location.origin);
  if (cwd) url.searchParams.set(CWD_QUERY_PARAM, cwd);
  return url.toString();
};

// ── State types ───────────────────────────────────────────────────────────────

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
  expiresAtMs: number;
  timer: number;
}
