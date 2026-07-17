import { beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_TERMINAL_FONT_SIZE_PX } from "../../src/lib/constants";
import { DEFAULT_TERMINAL_CURSOR_STYLE } from "../../src/features/terminal/cursor/terminal-cursor";
import { DEFAULT_TERMINAL_FONT_ID } from "../../src/features/terminal/fonts/terminal-fonts";
import { DEFAULT_TERMINAL_SCROLLBACK_LINES } from "../../src/features/terminal/scrollback/terminal-scrollback";
import { DEFAULT_TERMINAL_THEME_ID } from "../../src/features/terminal/theme/terminal-themes";

// Import after constants so mocks are in place before module-level slot creation
import {
  loadStoredLocalFontFamily,
  storeLocalFontFamily,
  loadStoredTerminalThemeId,
  storeTerminalThemeId,
  loadStoredTerminalFontId,
  storeTerminalFontId,
  loadStoredTerminalFontSize,
  storeTerminalFontSize,
  loadStoredTerminalLineHeight,
  storeTerminalLineHeight,
  loadStoredTerminalCursorStyle,
  storeTerminalCursorStyle,
  loadStoredTerminalCursorBlink,
  loadStoredTerminalScrollback,
  storeTerminalScrollback,
  loadStoredTerminalScrollOnUserInput,
} from "../../src/storage/storage-slots";

describe("storage-slots", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("localFontFamilySlot", () => {
    it("returns null by default", () => {
      expect(loadStoredLocalFontFamily()).toBeNull();
    });

    it("returns the stored family name", () => {
      storeLocalFontFamily("JetBrains Mono");
      expect(loadStoredLocalFontFamily()).toBe("JetBrains Mono");
    });

    it("trims whitespace from the stored value", () => {
      window.localStorage.setItem("localterm:local-font-family", "  Fira Code  ");
      expect(loadStoredLocalFontFamily()).toBe("Fira Code");
    });

    it("returns null for an empty string after trimming", () => {
      window.localStorage.setItem("localterm:local-font-family", "   ");
      expect(loadStoredLocalFontFamily()).toBeNull();
    });

    it("returns null for a whitespace-only value", () => {
      window.localStorage.setItem("localterm:local-font-family", "\t\n  ");
      expect(loadStoredLocalFontFamily()).toBeNull();
    });

    it("persists via storeLocalFontFamily", () => {
      storeLocalFontFamily("Cascadia Code");
      expect(window.localStorage.getItem("localterm:local-font-family")).toBe("Cascadia Code");
    });
  });

  describe("terminalThemeIdSlot", () => {
    it("returns the default theme id when nothing is stored", () => {
      expect(loadStoredTerminalThemeId()).toBe(DEFAULT_TERMINAL_THEME_ID);
    });

    it("returns a valid stored theme id", () => {
      storeTerminalThemeId("github-dark");
      expect(loadStoredTerminalThemeId()).toBe("github-dark");
    });

    it("falls back to default for unknown theme id", () => {
      window.localStorage.setItem("localterm:terminal-theme-id", "not-a-theme");
      expect(loadStoredTerminalThemeId()).toBe(DEFAULT_TERMINAL_THEME_ID);
    });
  });

  describe("terminalFontIdSlot", () => {
    it("returns the default font id when nothing is stored", () => {
      expect(loadStoredTerminalFontId()).toBe(DEFAULT_TERMINAL_FONT_ID);
    });

    it("returns a valid stored font id", () => {
      storeTerminalFontId("jetbrains-mono");
      expect(loadStoredTerminalFontId()).toBe("jetbrains-mono");
    });

    it("falls back to default for unknown font id", () => {
      window.localStorage.setItem("localterm:terminal-font-id", "nonexistent-font");
      expect(loadStoredTerminalFontId()).toBe(DEFAULT_TERMINAL_FONT_ID);
    });

    it("returns LOCAL_FONT_ID when local family is stored", () => {
      window.localStorage.setItem("localterm:terminal-font-id", "local");
      window.localStorage.setItem("localterm:local-font-family", "My Custom Font");
      expect(loadStoredTerminalFontId()).toBe("local");
    });

    it("falls back to default when LOCAL_FONT_ID is stored but no local family exists", () => {
      window.localStorage.setItem("localterm:terminal-font-id", "local");
      expect(loadStoredTerminalFontId()).toBe(DEFAULT_TERMINAL_FONT_ID);
    });
  });

  describe("terminalFontSizeSlot", () => {
    it("returns the default font size when nothing is stored", () => {
      expect(loadStoredTerminalFontSize()).toBe(DEFAULT_TERMINAL_FONT_SIZE_PX);
    });

    it("returns a stored font size", () => {
      storeTerminalFontSize(16);
      expect(loadStoredTerminalFontSize()).toBe(16);
    });

    it("clamps oversize values", () => {
      window.localStorage.setItem("localterm:terminal-font-size", "100");
      expect(loadStoredTerminalFontSize()).toBe(24);
    });

    it("clamps undersize values", () => {
      window.localStorage.setItem("localterm:terminal-font-size", "1");
      expect(loadStoredTerminalFontSize()).toBe(9);
    });

    it("rounds fractional values", () => {
      window.localStorage.setItem("localterm:terminal-font-size", "13.6");
      expect(loadStoredTerminalFontSize()).toBe(14);
    });

    it("falls back to default for NaN", () => {
      window.localStorage.setItem("localterm:terminal-font-size", "not-a-number");
      expect(loadStoredTerminalFontSize()).toBe(DEFAULT_TERMINAL_FONT_SIZE_PX);
    });
  });

  describe("terminalLineHeightSlot", () => {
    const DEFAULT_LINE_HEIGHT = 1.2;

    it("returns the default line height when nothing is stored", () => {
      expect(loadStoredTerminalLineHeight()).toBe(DEFAULT_LINE_HEIGHT);
    });

    it("returns a stored line height", () => {
      storeTerminalLineHeight(1.5);
      expect(loadStoredTerminalLineHeight()).toBe(1.5);
    });

    it("clamps oversize values", () => {
      window.localStorage.setItem("localterm:terminal-line-height", "3.0");
      expect(loadStoredTerminalLineHeight()).toBe(2.0);
    });

    it("clamps undersize values", () => {
      window.localStorage.setItem("localterm:terminal-line-height", "0.5");
      expect(loadStoredTerminalLineHeight()).toBe(1.0);
    });

    it("rounds to the nearest 0.1 step", () => {
      window.localStorage.setItem("localterm:terminal-line-height", "1.37");
      expect(loadStoredTerminalLineHeight()).toBe(1.4);
    });

    it("falls back to default for NaN", () => {
      window.localStorage.setItem("localterm:terminal-line-height", "abc");
      expect(loadStoredTerminalLineHeight()).toBe(DEFAULT_LINE_HEIGHT);
    });
  });

  describe("terminalCursorStyleSlot", () => {
    it("returns the default cursor style when nothing is stored", () => {
      expect(loadStoredTerminalCursorStyle()).toBe(DEFAULT_TERMINAL_CURSOR_STYLE);
    });

    it("returns a stored valid cursor style", () => {
      storeTerminalCursorStyle("bar");
      expect(loadStoredTerminalCursorStyle()).toBe("bar");
    });

    it("falls back to default for an invalid style", () => {
      window.localStorage.setItem("localterm:terminal-cursor-style", "hover");
      expect(loadStoredTerminalCursorStyle()).toBe(DEFAULT_TERMINAL_CURSOR_STYLE);
    });
  });

  describe("terminalCursorBlinkSlot", () => {
    it("returns the default blink value when nothing is stored", () => {
      // Default is true per constants
      expect(loadStoredTerminalCursorBlink()).toBe(true);
    });

    it("returns true for stored 'true'", () => {
      window.localStorage.setItem("localterm:terminal-cursor-blink", "true");
      expect(loadStoredTerminalCursorBlink()).toBe(true);
    });

    it("returns false for stored 'false'", () => {
      window.localStorage.setItem("localterm:terminal-cursor-blink", "false");
      expect(loadStoredTerminalCursorBlink()).toBe(false);
    });

    it("falls back to default for invalid string values", () => {
      window.localStorage.setItem("localterm:terminal-cursor-blink", "maybe");
      expect(loadStoredTerminalCursorBlink()).toBe(true);
    });

    it("falls back to default for empty string", () => {
      window.localStorage.setItem("localterm:terminal-cursor-blink", "");
      expect(loadStoredTerminalCursorBlink()).toBe(true);
    });
  });

  describe("terminalScrollbackSlot", () => {
    it("returns the default scrollback when nothing is stored", () => {
      expect(loadStoredTerminalScrollback()).toBe(DEFAULT_TERMINAL_SCROLLBACK_LINES);
    });

    it("returns a stored valid scrollback value", () => {
      storeTerminalScrollback(1000);
      expect(loadStoredTerminalScrollback()).toBe(1000);
    });

    it("returns an accepted preset value (50000)", () => {
      window.localStorage.setItem("localterm:terminal-scrollback", "50000");
      expect(loadStoredTerminalScrollback()).toBe(50000);
    });

    it("falls back to default for invalid scrollback value", () => {
      window.localStorage.setItem("localterm:terminal-scrollback", "9999");
      expect(loadStoredTerminalScrollback()).toBe(DEFAULT_TERMINAL_SCROLLBACK_LINES);
    });

    it("falls back to default for NaN", () => {
      window.localStorage.setItem("localterm:terminal-scrollback", "not-a-number");
      expect(loadStoredTerminalScrollback()).toBe(DEFAULT_TERMINAL_SCROLLBACK_LINES);
    });
  });

  describe("terminalScrollOnUserInputSlot", () => {
    it("returns the default when nothing is stored", () => {
      expect(loadStoredTerminalScrollOnUserInput()).toBe(true);
    });

    it("returns true for stored 'true'", () => {
      window.localStorage.setItem("localterm:terminal-scroll-on-user-input", "true");
      expect(loadStoredTerminalScrollOnUserInput()).toBe(true);
    });

    it("returns false for stored 'false'", () => {
      window.localStorage.setItem("localterm:terminal-scroll-on-user-input", "false");
      expect(loadStoredTerminalScrollOnUserInput()).toBe(false);
    });

    it("falls back to default for invalid string values", () => {
      window.localStorage.setItem("localterm:terminal-scroll-on-user-input", "nope");
      expect(loadStoredTerminalScrollOnUserInput()).toBe(true);
    });
  });
});
