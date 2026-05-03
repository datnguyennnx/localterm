import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TERMINAL_THEMES, findTerminalThemeById } from "@/lib/terminal-themes";
import { cn } from "@/lib/utils";

interface ThemePickerProps {
  value: string;
  onValueChange: (themeId: string) => void;
}

export const ThemePicker = ({ value, onValueChange }: ThemePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeTheme = findTerminalThemeById(value);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="terminal theme"
                  className="hover:text-foreground"
                />
              }
            />
          }
        >
          <Palette />
        </TooltipTrigger>
        {isOpen ? null : (
          <TooltipContent side="bottom" sideOffset={8}>
            Theme · {activeTheme.name}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-44 origin-top-right gap-0 overflow-hidden border border-border/60 bg-background/70 p-1 text-muted-foreground shadow-xs ring-0 backdrop-blur-md duration-150 ease-out data-closed:duration-100 data-closed:ease-in data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:blur-out-[5px] data-closed:slide-out-to-top-2 data-open:fade-in-0 data-open:zoom-in-95 data-open:blur-in-[5px] data-open:slide-in-from-top-2"
      >
        <div
          role="listbox"
          aria-label="terminal themes"
          className="flex max-h-72 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TERMINAL_THEMES.map((theme) => {
            const isActive = theme.id === value;
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onValueChange(theme.id)}
                className={cn(
                  "flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-xs leading-none outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:bg-foreground/10 focus-visible:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="truncate">{theme.name}</span>
                {isActive ? <Check className="size-3 shrink-0 opacity-70" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
