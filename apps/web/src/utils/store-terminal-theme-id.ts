import { TERMINAL_THEME_STORAGE_KEY } from "@/lib/constants";

export const storeTerminalThemeId = (themeId: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TERMINAL_THEME_STORAGE_KEY, themeId);
  } catch {
    /* localStorage unavailable (private mode, full quota); selection still applies in-session */
  }
};
