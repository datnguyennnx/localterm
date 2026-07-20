import type { TerminalScrollAnchor } from "@/features/terminal/scroll/capture-terminal-scroll-anchor";
import { estimateBytes, FLOW_HIGH_WATER_CALLBACKS, FLOW_LOW_WATER_CALLBACKS } from "./types";

/**
 * Maximum bytes per single terminal.write() call. Writes larger than this
 * are split into chunks and submitted sequentially via callbacks, giving
 * xterm.js's WriteBuffer a chance to yield to the event loop between chunks.
 * This prevents InputHandler.parse() from blocking rendering for >12ms.
 */
const WRITE_CHUNK_BYTES = 16_384; // 16 KB

export interface FlowControllerDeps {
  terminalWrite: (data: string | Uint8Array, callback?: () => void) => void;
  sendFlowPause: () => void;
  sendFlowResume: () => void;
  captureScrollAnchor: () => TerminalScrollAnchor;
  restoreScrollAnchor: (anchor: TerminalScrollAnchor) => void;
  hasScrollRestore: () => boolean;
  restoreScrollFromResize: () => void;
  isExited: () => boolean;
}

export interface FlowController {
  write: (data: string | Uint8Array) => void;
  clear: () => void;
}

export const createFlowController = (deps: FlowControllerDeps): FlowController => {
  let pendingCallbacks = 0;
  let isPaused = false;

  const restoreAfterOutputWrite = (outputScrollAnchor: TerminalScrollAnchor): void => {
    if (deps.hasScrollRestore()) {
      deps.restoreScrollFromResize();
      return;
    }
    if (outputScrollAnchor.wasAtBottom) deps.restoreScrollAnchor(outputScrollAnchor);
  };

  const write = (data: string | Uint8Array): void => {
    if (deps.isExited()) return;

    const byteLength = estimateBytes(data);

    // Chunk large writes so xterm.js's WriteBuffer can yield between chunks
    if (byteLength >= WRITE_CHUNK_BYTES) {
      const chunks: Array<string | Uint8Array> = [];
      let offset = 0;
      while (offset < byteLength) {
        const end = Math.min(offset + WRITE_CHUNK_BYTES, byteLength);
        chunks.push(
          typeof data === "string" ? data.slice(offset, end) : data.subarray(offset, end),
        );
        offset = end;
      }

      const scrollAnchor = deps.captureScrollAnchor();
      let chunkIndex = 0;

      const sendNextChunk = (): void => {
        if (chunkIndex >= chunks.length) return;
        const chunk = chunks[chunkIndex]!;
        chunkIndex++;

        if (!isPaused && pendingCallbacks >= FLOW_HIGH_WATER_CALLBACKS) {
          deps.sendFlowPause();
          isPaused = true;
        }

        deps.terminalWrite(chunk, () => {
          pendingCallbacks = Math.max(0, pendingCallbacks - 1);
          if (isPaused && pendingCallbacks < FLOW_LOW_WATER_CALLBACKS) {
            deps.sendFlowResume();
            isPaused = false;
          }

          // Only restore scroll position on the last chunk
          if (chunkIndex >= chunks.length) {
            restoreAfterOutputWrite(scrollAnchor);
          } else {
            deps.restoreScrollFromResize();
          }

          setTimeout(sendNextChunk, 0);
        });
        pendingCallbacks++;
      };

      sendNextChunk();
      return;
    }

    // Original path for normal-sized writes
    const outputScrollAnchor = deps.captureScrollAnchor();

    if (!isPaused && pendingCallbacks >= FLOW_HIGH_WATER_CALLBACKS) {
      deps.sendFlowPause();
      isPaused = true;
    }

    deps.terminalWrite(data, () => {
      pendingCallbacks = Math.max(0, pendingCallbacks - 1);
      if (isPaused && pendingCallbacks < FLOW_LOW_WATER_CALLBACKS) {
        deps.sendFlowResume();
        isPaused = false;
      }
      restoreAfterOutputWrite(outputScrollAnchor);
    });
    pendingCallbacks++;
  };

  const clear = (): void => {
    pendingCallbacks = 0;
    isPaused = false;
  };

  return { write, clear };
};
