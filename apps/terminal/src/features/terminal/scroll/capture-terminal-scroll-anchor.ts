export interface TerminalScrollAnchor {
  distanceFromBottom: number;
  wasAtBottom: boolean;
}

export interface TerminalScrollAnchorSource {
  buffer: {
    active: {
      baseY: number;
      viewportY: number;
    };
  };
}

export const captureTerminalScrollAnchor = (
  terminal: TerminalScrollAnchorSource,
): TerminalScrollAnchor => {
  const buffer = terminal.buffer.active;
  const distanceFromBottom = Math.max(0, buffer.baseY - buffer.viewportY);
  return {
    distanceFromBottom,
    wasAtBottom: distanceFromBottom === 0,
  };
};
