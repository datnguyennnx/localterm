import { Plus, Search } from "lucide-react";
import { SettingsMenu } from "@/components/settings-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOLTIP_SIDE_OFFSET_PX } from "@/lib/constants";
import type { TerminalCursorStyle } from "@/features/terminal/cursor/terminal-cursor";
import type { TerminalSessionInfo } from "@/features/terminal/session/terminal-session-info";

interface ToolbarProps {
  activeThemeId: string;
  onThemeChange: (id: string) => void;
  onThemePreview: (id: string | null) => void;
  activeFontId: string;
  onFontChange: (id: string) => void;
  onFontPreview: (id: string | null) => void;
  activeLocalFontFamily: string | null;
  onLocalFontChange: (family: string) => void;
  activeFontSize: number;
  onFontSizeChange: (size: number) => void;
  activeLineHeight: number;
  onLineHeightChange: (lineHeight: number) => void;
  activeCursorStyle: TerminalCursorStyle;
  onCursorStyleChange: (style: TerminalCursorStyle) => void;
  onCursorStylePreview: (style: TerminalCursorStyle | null) => void;
  activeCursorBlink: boolean;
  onCursorBlinkChange: (blink: boolean) => void;
  activeScrollback: number;
  onScrollbackChange: (scrollback: number) => void;
  activeScrollOnUserInput: boolean;
  onScrollOnUserInputChange: (scrollOnUserInput: boolean) => void;
  sessionInfo: TerminalSessionInfo | null;
  newTabUrl: string;
  onOpenSearch: () => void;
  isMac: boolean;
  isSearchOpen: boolean;
}

export const TerminalToolbar = ({
  activeThemeId,
  onThemeChange,
  onThemePreview,
  activeFontId,
  onFontChange,
  onFontPreview,
  activeLocalFontFamily,
  onLocalFontChange,
  activeFontSize,
  onFontSizeChange,
  activeLineHeight,
  onLineHeightChange,
  activeCursorStyle,
  onCursorStyleChange,
  onCursorStylePreview,
  activeCursorBlink,
  onCursorBlinkChange,
  activeScrollback,
  onScrollbackChange,
  activeScrollOnUserInput,
  onScrollOnUserInputChange,
  sessionInfo,
  newTabUrl,
  onOpenSearch,
  isMac,
  isSearchOpen,
}: ToolbarProps) => {
  if (isSearchOpen) return null;

  return (
    <div
      role="toolbar"
      aria-label="terminal actions"
      data-terminal-toolbar
      className="absolute top-2 right-3 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-background/70 p-0.5 text-muted-foreground shadow-xs backdrop-blur-md"
    >
      <SettingsMenu
        themeId={activeThemeId}
        onThemeChange={onThemeChange}
        onThemePreview={onThemePreview}
        fontId={activeFontId}
        onFontChange={onFontChange}
        onFontPreview={onFontPreview}
        localFontFamily={activeLocalFontFamily}
        onLocalFontChange={onLocalFontChange}
        fontSize={activeFontSize}
        onFontSizeChange={onFontSizeChange}
        lineHeight={activeLineHeight}
        onLineHeightChange={onLineHeightChange}
        cursorStyle={activeCursorStyle}
        onCursorStyleChange={onCursorStyleChange}
        onCursorStylePreview={onCursorStylePreview}
        cursorBlink={activeCursorBlink}
        onCursorBlinkChange={onCursorBlinkChange}
        scrollback={activeScrollback}
        onScrollbackChange={onScrollbackChange}
        scrollOnUserInput={activeScrollOnUserInput}
        onScrollOnUserInputChange={onScrollOnUserInputChange}
        sessionInfo={sessionInfo}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onOpenSearch}
              aria-label="find in terminal"
              className="hover:text-foreground"
            />
          }
        >
          <Search />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={TOOLTIP_SIDE_OFFSET_PX}>
          Find {isMac ? "(\u2318F)" : "(Ctrl+F)"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              aria-label="open a new shell in a new browser tab"
              render={<a href={newTabUrl} target="_blank" rel="noopener noreferrer" />}
              className="hover:text-foreground"
            />
          }
        >
          <Plus />
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={TOOLTIP_SIDE_OFFSET_PX}>
          New shell (new tab)
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
