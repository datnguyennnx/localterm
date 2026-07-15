import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_TERMINAL_THEME_ID,
  TERMINAL_THEMES,
  findTerminalThemeById,
} from "../../src/lib/terminal-themes";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

describe("terminal-themes registry", () => {
  it("ships with a curated set of themes", () => {
    expect(TERMINAL_THEMES.length).toBe(3);
    const ids = new Set(TERMINAL_THEMES.map((theme) => theme.id));
    expect(ids.size).toBe(TERMINAL_THEMES.length);
  });

  it("exposes the default theme id and it resolves to a real theme", () => {
    const theme = findTerminalThemeById(DEFAULT_TERMINAL_THEME_ID);
    expect(theme.id).toBe(DEFAULT_TERMINAL_THEME_ID);
  });

  it("falls back to the default theme for null, undefined, or unknown ids", () => {
    expect(findTerminalThemeById(null).id).toBe(DEFAULT_TERMINAL_THEME_ID);
    expect(findTerminalThemeById(undefined).id).toBe(DEFAULT_TERMINAL_THEME_ID);
    expect(findTerminalThemeById("not-a-real-theme").id).toBe(DEFAULT_TERMINAL_THEME_ID);
  });

  it.each(TERMINAL_THEMES.map((theme) => [theme.id, theme] as const))(
    "%s defines all 16 ANSI colors plus background/foreground/cursor",
    (_id, theme) => {
      const requiredKeys = [
        "background",
        "foreground",
        "cursor",
        "cursorAccent",
        "selectionBackground",
        "black",
        "red",
        "green",
        "yellow",
        "blue",
        "magenta",
        "cyan",
        "white",
        "brightBlack",
        "brightRed",
        "brightGreen",
        "brightYellow",
        "brightBlue",
        "brightMagenta",
        "brightCyan",
        "brightWhite",
      ] as const;

      for (const key of requiredKeys) {
        const colorValue = theme.colors[key];
        expect(colorValue, `${theme.id} is missing ${key}`).toBeDefined();
        expect(colorValue, `${theme.id}.${key} should be a 6-digit hex`).toMatch(HEX_COLOR);
      }
    },
  );
});
