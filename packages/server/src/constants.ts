export const DEFAULT_PORT = 3417;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_COLS = 120;
export const DEFAULT_ROWS = 32;
export const DEFAULT_SHELL_FALLBACK = "/bin/sh";

export const TERM_TYPE = "xterm-256color";
export const COLORTERM_VALUE = "truecolor";

export const PTY_ENV_DENYLIST = ["LOCALTERM_DAEMON_CHILD"];

export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_COLS = 1000;
export const MAX_ROWS = 1000;
export const WS_BACKPRESSURE_THRESHOLD_BYTES = 8 * 1024 * 1024;

export const LOOPBACK_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
  "0:0:0:0:0:0:0:1",
]);

export const HTTP_STATUS_NOT_FOUND = 404;

export const WS_READY_STATE_OPEN = 1;
export const WS_CLOSE_POLICY_VIOLATION = 1008;
export const WS_CLOSE_BACKPRESSURE = 4429;
