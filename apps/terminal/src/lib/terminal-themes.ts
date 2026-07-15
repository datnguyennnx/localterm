import type { ITheme } from "@xterm/xterm";

export interface TerminalTheme {
  id: string;
  name: string;
  source: string;
  colors: ITheme;
}

const VESPER: TerminalTheme = {
  id: "vesper",
  name: "Vesper",
  source: "raunofreiberg/vesper",
  colors: {
    background: "#101010",
    foreground: "#ffffff",
    cursor: "#ffc799",
    cursorAccent: "#101010",
    selectionBackground: "#2a2a2a",
    selectionForeground: "#ffffff",
    black: "#101010",
    red: "#ff8080",
    green: "#99ffe4",
    yellow: "#ffc799",
    blue: "#a0a0a0",
    magenta: "#ffc799",
    cyan: "#99ffe4",
    white: "#ffffff",
    brightBlack: "#505050",
    brightRed: "#ff9999",
    brightGreen: "#b3ffe4",
    brightYellow: "#ffd1a8",
    brightBlue: "#b0b0b0",
    brightMagenta: "#ffc799",
    brightCyan: "#66ddcc",
    brightWhite: "#ffffff",
  },
};

const GITHUB_DARK: TerminalTheme = {
  id: "github-dark",
  name: "GitHub Dark",
  source: "primer/github-vscode-theme + @primer/primitives",
  colors: {
    background: "#0d1117",
    foreground: "#e6edf3",
    cursor: "#e6edf3",
    cursorAccent: "#0d1117",
    selectionBackground: "#264f78",
    selectionForeground: "#e6edf3",
    black: "#484f58",
    red: "#ff7b72",
    green: "#3fb950",
    yellow: "#d29922",
    blue: "#58a6ff",
    magenta: "#bc8cff",
    cyan: "#39c5cf",
    white: "#b1bac4",
    brightBlack: "#6e7681",
    brightRed: "#ffa198",
    brightGreen: "#56d364",
    brightYellow: "#e3b341",
    brightBlue: "#79c0ff",
    brightMagenta: "#d2a8ff",
    brightCyan: "#56d4dd",
    brightWhite: "#ffffff",
  },
};

const GITHUB_LIGHT: TerminalTheme = {
  id: "github-light",
  name: "GitHub Light",
  source: "primer/github-vscode-theme + @primer/primitives",
  colors: {
    background: "#ffffff",
    foreground: "#1f2328",
    cursor: "#1f2328",
    cursorAccent: "#ffffff",
    selectionBackground: "#d1d9e0",
    selectionForeground: "#1f2328",
    black: "#656d76",
    red: "#d1242f",
    green: "#1a7f37",
    yellow: "#9a6700",
    blue: "#0969da",
    magenta: "#8250df",
    cyan: "#1b7c83",
    white: "#656d76",
    brightBlack: "#8b949e",
    brightRed: "#d1242f",
    brightGreen: "#1a7f37",
    brightYellow: "#9a6700",
    brightBlue: "#0969da",
    brightMagenta: "#8250df",
    brightCyan: "#1b7c83",
    brightWhite: "#1f2328",
  },
};

export const TERMINAL_THEMES: TerminalTheme[] = [VESPER, GITHUB_DARK, GITHUB_LIGHT];

export const DEFAULT_TERMINAL_THEME_ID: string = VESPER.id;

export const findTerminalThemeById = (id: string | null | undefined): TerminalTheme => {
  if (!id) return VESPER;
  return TERMINAL_THEMES.find((theme) => theme.id === id) ?? VESPER;
};
