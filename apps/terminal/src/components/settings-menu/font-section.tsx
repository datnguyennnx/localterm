import { MonitorCog } from "lucide-react";
import { NumberStepper } from "@/components/number-stepper";
import { SettingsSelect, type SettingsSelectItem } from "@/components/settings-select";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  TERMINAL_FONT_SIZE_MAX_PX,
  TERMINAL_FONT_SIZE_MIN_PX,
  TERMINAL_FONT_SIZE_STEP_PX,
  TERMINAL_LINE_HEIGHT_MAX,
  TERMINAL_LINE_HEIGHT_MIN,
  TERMINAL_LINE_HEIGHT_STEP,
} from "@/lib/constants";

const SECTION_LABEL_CLASSES =
  "text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase";

const ROW_LABEL_CLASSES = "text-xs font-normal text-muted-foreground";

const formatLineHeight = (value: number): string => value.toFixed(1);

interface FontSectionProps {
  fontId: string;
  fontItems: readonly SettingsSelectItem[];
  isFontSelectOpen: boolean;
  onFontChange: (fontId: string | null) => void;
  onFontPreview?: (fontId: string | null) => void;
  onFontSelectOpenChange: (open: boolean) => void;
  onOpenLocalFontPicker: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  lineHeight: number;
  onLineHeightChange: (lineHeight: number) => void;
}

export const FontSection = ({
  fontId,
  fontItems,
  isFontSelectOpen,
  onFontChange,
  onFontPreview,
  onFontSelectOpenChange,
  onOpenLocalFontPicker,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
}: FontSectionProps) => (
  <Field orientation="vertical" className="gap-1.5">
    <FieldLabel className={SECTION_LABEL_CLASSES}>Font</FieldLabel>
    <SettingsSelect
      value={fontId}
      items={fontItems}
      ariaLabel="select font"
      placeholder="Font"
      open={isFontSelectOpen}
      onValueChange={onFontChange}
      onOpenChange={onFontSelectOpenChange}
      onItemHover={onFontPreview}
      footerSlot={
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:bg-foreground/10 focus-visible:text-foreground"
          onClick={onOpenLocalFontPicker}
        >
          <MonitorCog className="size-3" />
          <span>Local font…</span>
        </button>
      }
    />
    <div className="flex items-center justify-between gap-2">
      <span className={ROW_LABEL_CLASSES}>Size</span>
      <NumberStepper
        value={fontSize}
        min={TERMINAL_FONT_SIZE_MIN_PX}
        max={TERMINAL_FONT_SIZE_MAX_PX}
        step={TERMINAL_FONT_SIZE_STEP_PX}
        ariaLabel="terminal font size"
        decrementAriaLabel="decrease font size"
        incrementAriaLabel="increase font size"
        onValueChange={onFontSizeChange}
      />
    </div>
    <div className="flex items-center justify-between gap-2">
      <span className={ROW_LABEL_CLASSES}>Line height</span>
      <NumberStepper
        value={lineHeight}
        min={TERMINAL_LINE_HEIGHT_MIN}
        max={TERMINAL_LINE_HEIGHT_MAX}
        step={TERMINAL_LINE_HEIGHT_STEP}
        ariaLabel="terminal line height"
        decrementAriaLabel="decrease line height"
        incrementAriaLabel="increase line height"
        formatDisplay={formatLineHeight}
        onValueChange={onLineHeightChange}
      />
    </div>
  </Field>
);
