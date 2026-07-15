import type { TerminalScrollAnchor } from "@/utils/capture-terminal-scroll-anchor";
import {
  estimateBytes,
  FLOW_CALLBACK_BYTE_LIMIT,
  FLOW_HIGH_WATER_CALLBACKS,
  FLOW_LOW_WATER_CALLBACKS,
} from "./types";

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
  let writtenSinceLastCallback = 0;
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
    const outputScrollAnchor = deps.captureScrollAnchor();
    const byteLength = estimateBytes(data);
    const prevWritten = writtenSinceLastCallback;
    writtenSinceLastCallback += byteLength;

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

    if (
      prevWritten < FLOW_CALLBACK_BYTE_LIMIT &&
      writtenSinceLastCallback >= FLOW_CALLBACK_BYTE_LIMIT
    ) {
      writtenSinceLastCallback = 0;
    }
  };

  const clear = (): void => {
    writtenSinceLastCallback = 0;
    pendingCallbacks = 0;
    isPaused = false;
  };

  return { write, clear };
};
