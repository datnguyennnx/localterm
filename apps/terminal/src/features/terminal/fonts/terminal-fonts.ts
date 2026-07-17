import { LOCAL_FONT_ID } from "@/lib/constants";
import { escapeCssFontFamily } from "./escape-css-font-family";

type TerminalFontSource = "fontsource" | "google" | "local" | "native";

export interface TerminalFont {
  id: string;
  name: string;
  family: string;
  source: TerminalFontSource;
}

const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const buildFamily = (primary: string): string =>
  `"${escapeCssFontFamily(primary)}", ${MONO_FALLBACK}`;

const buildLocalTerminalFont = (family: string): TerminalFont => ({
  id: LOCAL_FONT_ID,
  name: family,
  family: buildFamily(family),
  source: "local",
});

const BROWSER_NATIVE: TerminalFont = {
  id: "browser-native",
  name: "Browser Native",
  family: `"SF Mono", "Cascadia Code", "Consolas", "Liberation Mono", ${MONO_FALLBACK}`,
  source: "native",
};

const GEIST_MONO: TerminalFont = {
  id: "geist-mono",
  name: "Geist Mono",
  family: buildFamily("Geist Mono"),
  source: "fontsource",
};

const JETBRAINS_MONO: TerminalFont = {
  id: "jetbrains-mono",
  name: "JetBrains Mono",
  family: buildFamily("JetBrains Mono"),
  source: "google",
};

export const TERMINAL_FONTS: TerminalFont[] = [BROWSER_NATIVE, GEIST_MONO, JETBRAINS_MONO];

export const DEFAULT_TERMINAL_FONT_ID: string = GEIST_MONO.id;

export const findTerminalFontById = (
  id: string | null | undefined,
  localFontFamily?: string | null,
): TerminalFont => {
  if (id === LOCAL_FONT_ID && localFontFamily) return buildLocalTerminalFont(localFontFamily);
  if (!id) return GEIST_MONO;
  return TERMINAL_FONTS.find((font) => font.id === id) ?? GEIST_MONO;
};

export const buildGoogleFontsStylesheetHref = (): string => {
  const googleFonts = TERMINAL_FONTS.filter((font) => font.source === "google");
  if (googleFonts.length === 0) return "";
  const familyParams = googleFonts
    .map((font) => `family=${font.name.replace(/ /g, "+")}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
};
