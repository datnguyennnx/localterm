export const RECONNECT_DELAY_MS = 1000;
export const RESIZE_DEBOUNCE_MS = 80;
export const TERMINAL_FONT_SIZE_PX = 13;
export const TERMINAL_LINE_HEIGHT = 1.2;
export const TERMINAL_SCROLLBACK_LINES = 10000;
export const FALLBACK_TERMINAL_BACKGROUND_HEX = "#101010";
export const FALLBACK_MONO_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const DEFAULT_DOCUMENT_TITLE = "localterm";
export const DEAD_SESSION_TITLE_PREFIX = "† ";
export const DISCONNECT_MODAL_THRESHOLD_FAILURES = 2;
export const RESTART_COMMAND = "npx localterm@latest start";
export const COPY_FEEDBACK_MS = 1500;
export const RETRY_BUTTON_FEEDBACK_MS = 800;
export const FAVICON_ACTIVE_DEBOUNCE_MS = 250;
export const FAVICON_IDLE_DEBOUNCE_MS = 750;
export const FAVICON_DEAD_OPACITY = 0.35;
export const FAVICON_RECENT_HUES_LIMIT = 16;
export const FAVICON_HUE_GRID_STEP_DEG = 12;
export const FAVICON_HUE_JITTER_RANGE_DEG = FAVICON_HUE_GRID_STEP_DEG;
export const FAVICON_HUE_WHEEL_DEG = 360;

export const TOOLTIP_DELAY_MS = 300;
export const TOOLTIP_SIDE_OFFSET_PX = 8;

export const SEARCH_MATCH_BACKGROUND_HEX = "#ffc79944";
export const SEARCH_ACTIVE_MATCH_BACKGROUND_HEX = "#ffc799";
export const SEARCH_ACTIVE_MATCH_BORDER_HEX = "#ff8080";

export const TERMINAL_THEME_STORAGE_KEY = "localterm:terminal-theme-id";
export const FAVICON_SESSION_HUE_STORAGE_KEY = "localterm:favicon-hue";
export const FAVICON_RECENT_HUES_STORAGE_KEY = "localterm:recent-favicon-hues";
