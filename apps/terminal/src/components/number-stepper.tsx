import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { usePointerScrub } from "./hooks";

interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  decrementAriaLabel: string;
  incrementAriaLabel: string;
  formatDisplay?: (value: number) => string;
  onValueChange: (value: number) => void;
}

const FALLBACK_FORMAT = (value: number) => String(value);

const STEPPER_BUTTON_CLASSES =
  "size-7 rounded-none border-0 bg-transparent text-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 [&_svg]:size-3.5";

// `border-l!` overrides the ButtonGroup variant rule
// `[&>[data-slot]~[data-slot]]:border-l-0`, which strips the left border on
// every child after the first. Since our stepper buttons use `border-0`, that
// strip would leave the value cell with only a right border (no divider
// between `−` and the value). The `!` modifier wins regardless of class order
// after Tailwind merge. If shadcn ever changes ButtonGroup's border strategy,
// re-validate this rule.
const STEPPER_VALUE_CLASSES =
  "h-7 min-w-[3rem] cursor-ew-resize touch-none justify-center border-y-0 border-r border-l! border-border/60 bg-transparent px-1.5 text-xs font-medium tabular-nums text-foreground select-none hover:bg-foreground/5 focus-visible:outline-none focus-visible:bg-foreground/5";

export const NumberStepper = ({
  value,
  min,
  max,
  step,
  ariaLabel,
  decrementAriaLabel,
  incrementAriaLabel,
  formatDisplay = FALLBACK_FORMAT,
  onValueChange,
}: NumberStepperProps) => {
  const scrubHandlers = usePointerScrub({ value, min, max, step, onChange: onValueChange });

  return (
    <ButtonGroup
      aria-label={ariaLabel}
      className="h-7 overflow-hidden rounded-md border border-border/60"
    >
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onValueChange(value - step)}
        disabled={value <= min}
        aria-label={decrementAriaLabel}
        className={STEPPER_BUTTON_CLASSES}
      >
        <Minus />
      </Button>
      <ButtonGroupText
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatDisplay(value)}
        aria-orientation="horizontal"
        title="Drag or use arrow keys to adjust"
        className={STEPPER_VALUE_CLASSES}
        {...scrubHandlers}
        onPointerCancel={scrubHandlers.onPointerUp}
      >
        {formatDisplay(value)}
      </ButtonGroupText>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onValueChange(value + step)}
        disabled={value >= max}
        aria-label={incrementAriaLabel}
        className={STEPPER_BUTTON_CLASSES}
      >
        <Plus />
      </Button>
    </ButtonGroup>
  );
};
