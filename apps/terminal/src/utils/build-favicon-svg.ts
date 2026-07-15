import { FAVICON_DEAD_OPACITY } from "@/lib/constants";
import type { FaviconState } from "./favicon-state-store";

const IDLE_GLYPH = "<path d='m6 8 4 4-4 4M12 16h6'/>";
/**
 * Three horizontal dots — reads as a "pending / in progress" indicator in a
 * static favicon (Safari won't animate them, so a spinner pose looks broken).
 */
const ACTIVE_GLYPH = [
  "<circle cx='7' cy='12' r='1.5' fill='currentColor' stroke='none'/>",
  "<circle cx='12' cy='12' r='1.5' fill='currentColor' stroke='none'/>",
  "<circle cx='17' cy='12' r='1.5' fill='currentColor' stroke='none'/>",
].join("");

export const buildFaviconSvg = (hue: number, state: FaviconState): string => {
  const clampedHue = ((hue % 360) + 360) % 360;
  const fill = `hsl(${clampedHue} 80% 62%)`;
  // Deep tonal companion of the hue: same hue, low lightness. Gives ~7:1+
  // contrast on every hue (neutral grey on yellow/cyan was muddy) and reads
  // as one coherent color rather than "icon + background".
  const ink = `hsl(${clampedHue} 85% 12%)`;
  const innerGlyph = state === "active" ? ACTIVE_GLYPH : IDLE_GLYPH;
  const opacity = state === "dead" ? FAVICON_DEAD_OPACITY : 1;
  return [
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' color='${ink}' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='${opacity}'>`,
    `<rect x='2' y='4' width='20' height='16' rx='2' fill='${fill}'/>`,
    innerGlyph,
    "</svg>",
  ].join("");
};
