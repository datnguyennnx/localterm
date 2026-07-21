import {
  TERMINAL_PADDING_MIN_PX,
  TERMINAL_PADDING_MAX_PX,
  TERMINAL_PADDING_STEP_PX,
} from "@/lib/constants";

export const clampTerminalPaddingX = (padding: number): number => {
  const stepped = Math.round(padding / TERMINAL_PADDING_STEP_PX) * TERMINAL_PADDING_STEP_PX;
  return Math.max(TERMINAL_PADDING_MIN_PX, Math.min(TERMINAL_PADDING_MAX_PX, stepped));
};

export const clampTerminalPaddingY = clampTerminalPaddingX;

export const clampOuterPaddingX = (padding: number): number => {
  const stepped = Math.round(padding / TERMINAL_PADDING_STEP_PX) * TERMINAL_PADDING_STEP_PX;
  return Math.max(TERMINAL_PADDING_MIN_PX, Math.min(TERMINAL_PADDING_MAX_PX, stepped));
};

export const clampOuterPaddingY = clampOuterPaddingX;
