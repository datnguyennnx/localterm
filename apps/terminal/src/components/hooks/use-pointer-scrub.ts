import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { NUMBER_STEPPER_SCRUB_PIXELS_PER_STEP } from "@/lib/constants";

interface UsePointerScrubOptions {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const KEYBOARD_DELTA_BY_KEY: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

export function usePointerScrub({ value, min, max, step, onChange }: UsePointerScrubOptions) {
  const dragStartXRef = useRef<number | null>(null);
  const dragStartValueRef = useRef<number>(value);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom and some browsers reject pointer capture; drag still works without it */
    }
    dragStartXRef.current = event.clientX;
    dragStartValueRef.current = value;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startX = dragStartXRef.current;
    if (startX === null) return;
    const deltaPixels = event.clientX - startX;
    const stepDelta = Math.round(deltaPixels / NUMBER_STEPPER_SCRUB_PIXELS_PER_STEP);
    if (stepDelta === 0) return;
    const rawValue = dragStartValueRef.current + stepDelta * step;
    onChange(Math.max(min, Math.min(max, rawValue)));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) return;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* see onPointerDown */
    }
    dragStartXRef.current = null;
  };

  const onPointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) return;
    // When pointer capture is held, leaving the element doesn't end the drag —
    // the captured pointer keeps firing move events. We only reset if capture
    // is NOT held, which covers jsdom and rare browsers without pointer capture.
    let captureHeld = false;
    try {
      captureHeld = event.currentTarget.hasPointerCapture(event.pointerId);
    } catch {
      /* see onPointerDown */
    }
    if (!captureHeld) dragStartXRef.current = null;
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(max);
      return;
    }
    const direction = KEYBOARD_DELTA_BY_KEY[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    onChange(Math.max(min, Math.min(max, value + direction * step)));
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onKeyDown };
}
