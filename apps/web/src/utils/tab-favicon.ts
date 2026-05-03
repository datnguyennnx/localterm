const SESSION_HUE_KEY = "localterm:favicon-hue";
const RECENT_HUES_KEY = "localterm:recent-favicon-hues";
const MAX_RECENT_HUES = 16;
const HUE_GRID_STEP = 12;
const HUE_JITTER_RANGE = HUE_GRID_STEP;

const safeReadLocal = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage?.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return parsed as T;
  } catch {
    return fallback;
  }
};

const safeWriteLocal = (key: string, value: unknown): void => {
  try {
    window.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be disabled in private mode */
  }
};

const safeReadSession = (key: string): string | null => {
  try {
    return window.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeWriteSession = (key: string, value: string): void => {
  try {
    window.sessionStorage?.setItem(key, value);
  } catch {
    /* storage may be disabled in private mode */
  }
};

const wrappedHueDistance = (a: number, b: number): number => {
  const direct = Math.abs(a - b);
  return Math.min(direct, 360 - direct);
};

/**
 * Pick a hue maximally distant from `recent`, then jitter so hues from
 * different tabs don't all land on the same coarse grid.
 */
const pickDistantHue = (recent: readonly number[]): number => {
  if (recent.length === 0) return Math.floor(Math.random() * 360);

  let bestHue = 0;
  let bestMinDistance = -1;
  for (let candidate = 0; candidate < 360; candidate += HUE_GRID_STEP) {
    let minDistance = 360;
    for (const used of recent) {
      const distance = wrappedHueDistance(candidate, used);
      if (distance < minDistance) minDistance = distance;
    }
    if (minDistance > bestMinDistance) {
      bestMinDistance = minDistance;
      bestHue = candidate;
    }
  }

  const jitter = Math.floor((Math.random() - 0.5) * HUE_JITTER_RANGE);
  return (bestHue + jitter + 360) % 360;
};

const readPersistedHue = (): number | null => {
  const stored = safeReadSession(SESSION_HUE_KEY);
  if (!stored) return null;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : null;
};

export const pickTabHue = (): number => {
  const persisted = readPersistedHue();
  if (persisted !== null) return persisted;

  const recent = safeReadLocal<number[]>(RECENT_HUES_KEY, []);
  const validRecent = Array.isArray(recent) ? recent.filter((n) => Number.isFinite(n)) : [];
  const hue = pickDistantHue(validRecent);

  safeWriteSession(SESSION_HUE_KEY, String(hue));
  safeWriteLocal(RECENT_HUES_KEY, [...validRecent, hue].slice(-MAX_RECENT_HUES));

  return hue;
};

export type FaviconState = "idle" | "active" | "dead";

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

const DEAD_FAVICON_OPACITY = 0.35;

const buildFaviconSvg = (hue: number, state: FaviconState): string => {
  const fill = `hsl(${hue} 80% 62%)`;
  // Deep tonal companion of the hue: same hue, low lightness. Gives ~7:1+
  // contrast on every hue (neutral grey on yellow/cyan was muddy) and reads
  // as one coherent color rather than "icon + background".
  const ink = `hsl(${hue} 85% 12%)`;
  const innerGlyph = state === "active" ? ACTIVE_GLYPH : IDLE_GLYPH;
  const opacity = state === "dead" ? DEAD_FAVICON_OPACITY : 1;
  return [
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' color='${ink}' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='${opacity}'>`,
    `<rect x='2' y='4' width='20' height='16' rx='2' fill='${fill}'/>`,
    innerGlyph,
    "</svg>",
  ].join("");
};

let cachedHue: number | null = null;
let currentState: FaviconState = "idle";

const getHue = (): number => {
  if (cachedHue === null) cachedHue = pickTabHue();
  return cachedHue;
};

export const setTabFaviconState = (state: FaviconState): void => {
  if (typeof document === "undefined") return;
  if (state === currentState && cachedHue !== null) return;
  currentState = state;
  const href = `data:image/svg+xml,${encodeURIComponent(buildFaviconSvg(getHue(), state))}`;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = href;
};

export const applyTabFavicon = (): void => {
  cachedHue = null;
  currentState = "idle";
  setTabFaviconState("idle");
};
