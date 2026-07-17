import { createStorageSlot } from "./create-storage-slot";
import {
  DEFAULT_TERMINAL_CURSOR_BLINK,
  DEFAULT_TERMINAL_FONT_SIZE_PX,
  DEFAULT_TERMINAL_LINE_HEIGHT,
  DEFAULT_TERMINAL_SCROLL_ON_USER_INPUT,
  LOCAL_FONT_FAMILY_STORAGE_KEY,
  LOCAL_FONT_ID,
  TERMINAL_CURSOR_BLINK_STORAGE_KEY,
  TERMINAL_CURSOR_STYLE_STORAGE_KEY,
  TERMINAL_FONT_SIZE_STORAGE_KEY,
  TERMINAL_FONT_STORAGE_KEY,
  TERMINAL_LINE_HEIGHT_STORAGE_KEY,
  TERMINAL_SCROLLBACK_STORAGE_KEY,
  TERMINAL_SCROLL_ON_USER_INPUT_STORAGE_KEY,
  TERMINAL_THEME_STORAGE_KEY,
} from "@/lib/constants";
import {
  DEFAULT_TERMINAL_CURSOR_STYLE,
  isTerminalCursorStyle,
  type TerminalCursorStyle,
} from "@/features/terminal/cursor/terminal-cursor";
import {
  DEFAULT_TERMINAL_FONT_ID,
  findTerminalFontById,
} from "@/features/terminal/fonts/terminal-fonts";
import {
  DEFAULT_TERMINAL_SCROLLBACK_LINES,
  isTerminalScrollbackValue,
} from "@/features/terminal/scrollback/terminal-scrollback";
import {
  DEFAULT_TERMINAL_THEME_ID,
  findTerminalThemeById,
} from "@/features/terminal/theme/terminal-themes";
import { clampTerminalFontSize } from "@/features/terminal/fonts/clamp-terminal-font-size";
import { clampTerminalLineHeight } from "@/features/terminal/fonts/clamp-terminal-line-height";

// Stores a user-entered font family name (or null if none). The
// deserialize trims whitespace and returns null for empty strings.
export const localFontFamilySlot = createStorageSlot<string | null>(
  LOCAL_FONT_FAMILY_STORAGE_KEY,
  null,
  (raw) => raw.trim() || null,
);

export const loadStoredLocalFontFamily = (): string | null => localFontFamilySlot.load();
export const storeLocalFontFamily = (family: string): void => localFontFamilySlot.store(family);

export const terminalThemeIdSlot = createStorageSlot(
  TERMINAL_THEME_STORAGE_KEY,
  DEFAULT_TERMINAL_THEME_ID,
  (raw) => findTerminalThemeById(raw).id,
);

export const loadStoredTerminalThemeId = (): string => terminalThemeIdSlot.load();
export const storeTerminalThemeId = (themeId: string): void => terminalThemeIdSlot.store(themeId);

export const terminalFontIdSlot = createStorageSlot(
  TERMINAL_FONT_STORAGE_KEY,
  DEFAULT_TERMINAL_FONT_ID,
  (raw) => {
    if (raw === LOCAL_FONT_ID) {
      const localFamily = localFontFamilySlot.load();
      return localFamily ? LOCAL_FONT_ID : DEFAULT_TERMINAL_FONT_ID;
    }
    return findTerminalFontById(raw).id;
  },
);

export const loadStoredTerminalFontId = (): string => terminalFontIdSlot.load();
export const storeTerminalFontId = (fontId: string): void => terminalFontIdSlot.store(fontId);

export const terminalFontSizeSlot = createStorageSlot(
  TERMINAL_FONT_SIZE_STORAGE_KEY,
  DEFAULT_TERMINAL_FONT_SIZE_PX,
  (raw) => clampTerminalFontSize(Number(raw)),
);

export const loadStoredTerminalFontSize = (): number => terminalFontSizeSlot.load();
export const storeTerminalFontSize = (size: number): void => terminalFontSizeSlot.store(size);

export const terminalLineHeightSlot = createStorageSlot(
  TERMINAL_LINE_HEIGHT_STORAGE_KEY,
  DEFAULT_TERMINAL_LINE_HEIGHT,
  (raw) => clampTerminalLineHeight(Number(raw)),
);

export const loadStoredTerminalLineHeight = (): number => terminalLineHeightSlot.load();
export const storeTerminalLineHeight = (lineHeight: number): void =>
  terminalLineHeightSlot.store(lineHeight);

export const terminalCursorStyleSlot = createStorageSlot<TerminalCursorStyle>(
  TERMINAL_CURSOR_STYLE_STORAGE_KEY,
  DEFAULT_TERMINAL_CURSOR_STYLE,
  (raw) => (isTerminalCursorStyle(raw) ? raw : DEFAULT_TERMINAL_CURSOR_STYLE),
);

export const loadStoredTerminalCursorStyle = (): TerminalCursorStyle =>
  terminalCursorStyleSlot.load();
export const storeTerminalCursorStyle = (cursorStyle: TerminalCursorStyle): void =>
  terminalCursorStyleSlot.store(cursorStyle);

export const terminalCursorBlinkSlot = createStorageSlot(
  TERMINAL_CURSOR_BLINK_STORAGE_KEY,
  DEFAULT_TERMINAL_CURSOR_BLINK,
  (raw) => {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return DEFAULT_TERMINAL_CURSOR_BLINK;
  },
);

export const loadStoredTerminalCursorBlink = (): boolean => terminalCursorBlinkSlot.load();
export const storeTerminalCursorBlink = (cursorBlink: boolean): void =>
  terminalCursorBlinkSlot.store(cursorBlink);

export const terminalScrollbackSlot = createStorageSlot(
  TERMINAL_SCROLLBACK_STORAGE_KEY,
  DEFAULT_TERMINAL_SCROLLBACK_LINES,
  (raw) => {
    const parsed = Number(raw);
    return isTerminalScrollbackValue(parsed) ? parsed : DEFAULT_TERMINAL_SCROLLBACK_LINES;
  },
);

export const loadStoredTerminalScrollback = (): number => terminalScrollbackSlot.load();
export const storeTerminalScrollback = (scrollback: number): void =>
  terminalScrollbackSlot.store(scrollback);

export const terminalScrollOnUserInputSlot = createStorageSlot(
  TERMINAL_SCROLL_ON_USER_INPUT_STORAGE_KEY,
  DEFAULT_TERMINAL_SCROLL_ON_USER_INPUT,
  (raw) => {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return DEFAULT_TERMINAL_SCROLL_ON_USER_INPUT;
  },
);

export const loadStoredTerminalScrollOnUserInput = (): boolean =>
  terminalScrollOnUserInputSlot.load();
export const storeTerminalScrollOnUserInput = (scrollOnUserInput: boolean): void =>
  terminalScrollOnUserInputSlot.store(scrollOnUserInput);
