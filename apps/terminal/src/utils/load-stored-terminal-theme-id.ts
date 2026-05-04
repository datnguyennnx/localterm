import { DEFAULT_TERMINAL_THEME_ID, findTerminalThemeById } from "@/lib/terminal-themes";
import { TERMINAL_THEME_STORAGE_KEY } from "@/lib/constants";

export const loadStoredTerminalThemeId = (): string => {
  if (typeof window === "undefined") return DEFAULT_TERMINAL_THEME_ID;
  try {
    const stored = window.localStorage.getItem(TERMINAL_THEME_STORAGE_KEY);
    return findTerminalThemeById(stored).id;
  } catch {
    return DEFAULT_TERMINAL_THEME_ID;
  }
};
