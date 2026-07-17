import { SettingsSelect, type SettingsSelectItem } from "@/components/settings-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  TERMINAL_CURSOR_STYLES,
  type TerminalCursorStyle,
} from "@/features/terminal/cursor/terminal-cursor";

const SECTION_LABEL_CLASSES =
  "text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase";

const ROW_LABEL_CLASSES = "text-xs font-normal text-muted-foreground";

const CURSOR_STYLE_ITEMS: readonly SettingsSelectItem[] = TERMINAL_CURSOR_STYLES.map((option) => ({
  id: option.id,
  label: option.name,
}));

interface CursorSectionProps {
  cursorStyle: TerminalCursorStyle;
  onCursorStyleChange: (next: string | null) => void;
  onCursorStyleSelectOpenChange?: (open: boolean) => void;
  onCursorStyleHover?: (next: string) => void;
  cursorBlink: boolean;
  onCursorBlinkChange: (blink: boolean) => void;
}

export const CursorSection = ({
  cursorStyle,
  onCursorStyleChange,
  onCursorStyleSelectOpenChange,
  onCursorStyleHover,
  cursorBlink,
  onCursorBlinkChange,
}: CursorSectionProps) => (
  <Field orientation="vertical" className="gap-1.5">
    <FieldLabel className={SECTION_LABEL_CLASSES}>Cursor</FieldLabel>
    <div className="flex items-center justify-between gap-2">
      <span className={ROW_LABEL_CLASSES}>Style</span>
      <SettingsSelect
        value={cursorStyle}
        items={CURSOR_STYLE_ITEMS}
        ariaLabel="select cursor style"
        placeholder="Cursor style"
        triggerClassName="w-fit min-w-[7rem]"
        onValueChange={onCursorStyleChange}
        onOpenChange={onCursorStyleSelectOpenChange}
        onItemHover={onCursorStyleHover}
      />
    </div>
    <div className="flex items-center justify-between gap-2">
      <span className={ROW_LABEL_CLASSES}>Blink</span>
      <Switch
        aria-label="toggle cursor blink"
        checked={cursorBlink}
        onCheckedChange={onCursorBlinkChange}
      />
    </div>
  </Field>
);
