import { useMemo, useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { type SettingsSelectItem } from "@/components/settings-select";
import { LOCAL_FONT_ID } from "@/lib/constants";
import {
  isTerminalCursorStyle,
  type TerminalCursorStyle,
} from "@/features/terminal/cursor/terminal-cursor";
import { TERMINAL_FONTS } from "@/features/terminal/fonts/terminal-fonts";
import { escapeCssFontFamily } from "@/features/terminal/fonts/escape-css-font-family";
import { isTerminalScrollbackValue } from "@/features/terminal/scrollback/terminal-scrollback";
import type { TerminalSessionInfo } from "@/features/terminal/session/terminal-session-info";

export interface SettingsMenuProps {
  themeId: string;
  onThemeChange: (themeId: string) => void;
  onThemePreview?: (themeId: string | null) => void;
  fontId: string;
  onFontChange: (fontId: string) => void;
  onFontPreview?: (fontId: string | null) => void;
  localFontFamily: string | null;
  onLocalFontChange: (family: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  lineHeight: number;
  onLineHeightChange: (lineHeight: number) => void;
  cursorStyle: TerminalCursorStyle;
  onCursorStyleChange: (style: TerminalCursorStyle) => void;
  onCursorStylePreview?: (style: TerminalCursorStyle | null) => void;
  cursorBlink: boolean;
  onCursorBlinkChange: (blink: boolean) => void;
  scrollback: number;
  onScrollbackChange: (scrollback: number) => void;
  scrollOnUserInput: boolean;
  onScrollOnUserInputChange: (scrollOnUserInput: boolean) => void;
  sessionInfo?: TerminalSessionInfo | null;
}

const FONT_ITEM_STYLE_BY_ID: Record<string, CSSProperties> = Object.fromEntries(
  TERMINAL_FONTS.map((font) => [font.id, { fontFamily: font.family }]),
);

const BUILTIN_FONT_ITEMS: readonly SettingsSelectItem[] = TERMINAL_FONTS.map((font) => ({
  id: font.id,
  label: font.name,
  itemStyle: FONT_ITEM_STYLE_BY_ID[font.id],
}));

const buildLocalFontItem = (family: string): SettingsSelectItem => ({
  id: LOCAL_FONT_ID,
  label: (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{family}</span>
      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
        Local
      </Badge>
    </span>
  ),
  itemStyle: { fontFamily: `"${escapeCssFontFamily(family)}", ui-monospace, monospace` },
});

export const useSettingsMenu = ({
  onThemeChange,
  onThemePreview,
  fontId,
  onFontChange,
  onFontPreview,
  localFontFamily,
  onCursorStyleChange,
  onCursorStylePreview,
  onScrollbackChange,
}: SettingsMenuProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFontSelectOpen, setIsFontSelectOpen] = useState(false);
  const [isLocalFontPickerOpen, setIsLocalFontPickerOpen] = useState(false);

  const fontItems = useMemo<readonly SettingsSelectItem[]>(() => {
    if (fontId !== LOCAL_FONT_ID || !localFontFamily) return BUILTIN_FONT_ITEMS;
    return [...BUILTIN_FONT_ITEMS, buildLocalFontItem(localFontFamily)];
  }, [fontId, localFontFamily]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setIsFontSelectOpen(false);
      setIsLocalFontPickerOpen(false);
      onThemePreview?.(null);
      onFontPreview?.(null);
      onCursorStylePreview?.(null);
    }
  };

  const openLocalFontPicker = () => {
    setIsFontSelectOpen(false);
    setIsLocalFontPickerOpen(true);
  };

  const handleThemeChange = (next: string | null) => {
    if (next) onThemeChange(next);
  };

  const handleFontChange = (next: string | null) => {
    if (next) onFontChange(next);
  };

  const handleCursorStyleChange = (next: string | null) => {
    if (isTerminalCursorStyle(next)) onCursorStyleChange(next);
  };

  const handleScrollbackChange = (next: string | null) => {
    if (next === null) return;
    const parsed = Number(next);
    if (isTerminalScrollbackValue(parsed)) onScrollbackChange(parsed);
  };

  const handleThemeSelectOpenChange = (open: boolean) => {
    if (!open) onThemePreview?.(null);
  };

  const handleFontSelectOpenChange = (open: boolean) => {
    setIsFontSelectOpen(open);
    if (!open) onFontPreview?.(null);
  };

  const handleCursorStyleSelectOpenChange = (open: boolean) => {
    if (!open) onCursorStylePreview?.(null);
  };

  const handleCursorStyleHover = (next: string) => {
    if (isTerminalCursorStyle(next)) onCursorStylePreview?.(next);
  };

  return {
    isDialogOpen,
    isFontSelectOpen,
    isLocalFontPickerOpen,
    setIsLocalFontPickerOpen,
    fontItems,
    handleDialogOpenChange,
    openLocalFontPicker,
    handleThemeChange,
    handleFontChange,
    handleCursorStyleChange,
    handleScrollbackChange,
    handleThemeSelectOpenChange,
    handleFontSelectOpenChange,
    handleCursorStyleSelectOpenChange,
    handleCursorStyleHover,
  };
};
