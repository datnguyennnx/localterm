import { Settings } from "lucide-react";
import { LocalFontPicker } from "@/components/local-font-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TRANSLUCENT_PANEL_CLASSES } from "@/lib/animation-classes";
import { TOOLTIP_SIDE_OFFSET_PX } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ThemeSection } from "./settings-menu/theme-section";
import { FontSection } from "./settings-menu/font-section";
import { CursorSection } from "./settings-menu/cursor-section";
import { ScrollbackSection } from "./settings-menu/scrollback-section";
import { ShellInfoSection } from "./settings-menu/shell-info-section";
import { useSettingsMenu, type SettingsMenuProps } from "./settings-menu/use-settings-menu";

export const SettingsMenu = (props: SettingsMenuProps) => {
  const {
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
  } = useSettingsMenu(props);

  const {
    themeId,
    onThemePreview,
    fontId,
    onFontPreview,
    localFontFamily,
    onLocalFontChange,
    fontSize,
    onFontSizeChange,
    lineHeight,
    onLineHeightChange,
    cursorStyle,
    onCursorStylePreview,
    cursorBlink,
    onCursorBlinkChange,
    scrollback,
    scrollOnUserInput,
    onScrollOnUserInputChange,
    sessionInfo,
  } = props;

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="terminal settings"
                  className="hover:text-foreground"
                />
              }
            />
          }
        >
          <Settings />
        </TooltipTrigger>
        {isDialogOpen ? null : (
          <TooltipContent side="bottom" sideOffset={TOOLTIP_SIDE_OFFSET_PX}>
            Settings
          </TooltipContent>
        )}
      </Tooltip>
      <DialogContent
        className={cn(
          "max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-4 sm:max-w-md",
          TRANSLUCENT_PANEL_CLASSES,
        )}
      >
        <DialogHeader className="mb-4 pr-8">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <FieldGroup className="gap-3">
          <ThemeSection
            themeId={themeId}
            onThemeChange={handleThemeChange}
            onThemePreview={onThemePreview}
            onOpenChange={handleThemeSelectOpenChange}
          />

          <Separator className="bg-border/40" />

          <FontSection
            fontId={fontId}
            fontItems={fontItems}
            isFontSelectOpen={isFontSelectOpen}
            onFontChange={handleFontChange}
            onFontPreview={onFontPreview}
            onFontSelectOpenChange={handleFontSelectOpenChange}
            onOpenLocalFontPicker={openLocalFontPicker}
            fontSize={fontSize}
            onFontSizeChange={onFontSizeChange}
            lineHeight={lineHeight}
            onLineHeightChange={onLineHeightChange}
          />

          <Separator className="bg-border/40" />

          <CursorSection
            cursorStyle={cursorStyle}
            onCursorStyleChange={handleCursorStyleChange}
            onCursorStyleSelectOpenChange={handleCursorStyleSelectOpenChange}
            onCursorStyleHover={onCursorStylePreview ? handleCursorStyleHover : undefined}
            cursorBlink={cursorBlink}
            onCursorBlinkChange={onCursorBlinkChange}
          />

          <Separator className="bg-border/40" />

          <ScrollbackSection
            scrollback={scrollback}
            onScrollbackChange={handleScrollbackChange}
            scrollOnUserInput={scrollOnUserInput}
            onScrollOnUserInputChange={onScrollOnUserInputChange}
          />

          <ShellInfoSection sessionInfo={sessionInfo ?? null} />
        </FieldGroup>
      </DialogContent>
      <LocalFontPicker
        open={isLocalFontPickerOpen}
        onOpenChange={setIsLocalFontPickerOpen}
        currentFamily={localFontFamily}
        onApply={onLocalFontChange}
      />
    </Dialog>
  );
};
