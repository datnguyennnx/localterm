import { SettingsSelect, type SettingsSelectItem } from "@/components/settings-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOLTIP_SIDE_OFFSET_PX } from "@/lib/constants";
import { TERMINAL_SCROLLBACK_PRESETS } from "@/features/terminal/scrollback/terminal-scrollback";

const SECTION_LABEL_CLASSES =
  "text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase";

const ROW_LABEL_CLASSES = "text-xs font-normal text-muted-foreground";

const SCROLLBACK_ITEMS: readonly SettingsSelectItem[] = TERMINAL_SCROLLBACK_PRESETS.map(
  (preset) => ({
    id: String(preset.value),
    label: preset.label,
  }),
);

interface ScrollbackSectionProps {
  scrollback: number;
  onScrollbackChange: (next: string | null) => void;
  scrollOnUserInput: boolean;
  onScrollOnUserInputChange: (scrollOnUserInput: boolean) => void;
}

export const ScrollbackSection = ({
  scrollback,
  onScrollbackChange,
  scrollOnUserInput,
  onScrollOnUserInputChange,
}: ScrollbackSectionProps) => (
  <Field orientation="vertical" className="gap-1.5">
    <FieldLabel className={SECTION_LABEL_CLASSES}>Scrollback</FieldLabel>
    <SettingsSelect
      value={String(scrollback)}
      items={SCROLLBACK_ITEMS}
      ariaLabel="select scrollback"
      placeholder="Scrollback"
      onValueChange={onScrollbackChange}
    />
    <div className="flex items-center justify-between gap-2">
      <Tooltip>
        <TooltipTrigger render={<span className={ROW_LABEL_CLASSES} />}>
          Pin to bottom on input
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={TOOLTIP_SIDE_OFFSET_PX} className="max-w-xs">
          When on, typing scrolls the viewport back to the bottom. When off, the viewport stays
          where you scrolled — useful for reading history while typing.
        </TooltipContent>
      </Tooltip>
      <Switch
        aria-label="toggle pin to bottom on input"
        checked={scrollOnUserInput}
        onCheckedChange={onScrollOnUserInputChange}
      />
    </div>
  </Field>
);
