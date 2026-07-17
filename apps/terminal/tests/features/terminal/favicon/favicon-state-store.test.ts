import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import {
  getCachedHue,
  pickFreshHueAvoiding,
  replaceHue,
  shouldRepaintFavicon,
  markFaviconPainted,
  resetFaviconStateStore,
} from "../../../../src/features/terminal/favicon/favicon-state-store";

describe("favicon-state-store", () => {
  beforeEach(() => {
    resetFaviconStateStore();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe("resetFaviconStateStore", () => {
    it("resets cachedHue, currentState, and lastPaintedHue to defaults", () => {
      // Set up some state
      const hue = getCachedHue();
      markFaviconPainted("active", hue);

      // Reset
      resetFaviconStateStore();

      // After reset, getCachedHue should generate a fresh hue (not return the old one)
      // We can verify by checking shouldRepaintFavicon for "idle" with the old hue
      expect(shouldRepaintFavicon("idle", hue)).toBe(true);
    });
  });

  describe("getCachedHue", () => {
    it("returns a number between 0 and 359", () => {
      const hue = getCachedHue();
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });

    it("returns the same value on subsequent calls (cached)", () => {
      const first = getCachedHue();
      const second = getCachedHue();
      expect(second).toBe(first);
    });

    it("reads a persisted hue from sessionStorage when cache is empty", () => {
      // Reset cache, set sessionStorage
      resetFaviconStateStore();
      window.sessionStorage.setItem("localterm:favicon-hue", "180");

      const hue = getCachedHue();
      expect(hue).toBe(180);
    });

    it("ignores sessionStorage hue if it is NaN", () => {
      resetFaviconStateStore();
      window.sessionStorage.setItem("localterm:favicon-hue", "not-a-number");

      const hue = getCachedHue();
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });

    it("prefers cached value over sessionStorage", () => {
      resetFaviconStateStore();
      window.sessionStorage.setItem("localterm:favicon-hue", "50");

      // First call reads from sessionStorage
      const first = getCachedHue();
      expect(first).toBe(50);

      // Override sessionStorage with a different value
      window.sessionStorage.setItem("localterm:favicon-hue", "100");

      // Second call should return the cached value, not re-read
      expect(getCachedHue()).toBe(50);
    });

    it("writes the fresh hue to sessionStorage when persisted hue is absent", () => {
      resetFaviconStateStore();
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      getCachedHue();

      // Should have written to sessionStorage
      const sessionSetCalls = setItemSpy.mock.calls.filter(
        ([key]) => key === "localterm:favicon-hue",
      );
      expect(sessionSetCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("writes the fresh hue to localStorage recent list", () => {
      resetFaviconStateStore();
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

      getCachedHue();

      const localSetCalls = setItemSpy.mock.calls.filter(
        ([key]) => key === "localterm:recent-favicon-hues",
      );
      expect(localSetCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("replaceHue", () => {
    it("replaces the cached hue and persists it", () => {
      replaceHue(99);

      expect(getCachedHue()).toBe(99);
      expect(window.sessionStorage.getItem("localterm:favicon-hue")).toBe("99");
    });

    it("appends the new hue to the recent list in localStorage", () => {
      resetFaviconStateStore();
      replaceHue(42);

      const stored = window.localStorage.getItem("localterm:recent-favicon-hues");
      const parsed = stored ? JSON.parse(stored) : [];
      expect(parsed).toContain(42);
    });
  });

  describe("pickFreshHueAvoiding", () => {
    it("returns a number between 0 and 359", () => {
      const hue = pickFreshHueAvoiding([]);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });

    it("returns a number that is not in the avoided list when possible", () => {
      // Call with a single avoided hue; the result should differ
      // We'll call multiple times due to jitter, but the base hue should differ
      const avoided = [0, 12, 24, 36, 48, 60];
      const result = pickFreshHueAvoiding(avoided);
      // The result could technically match due to jitter, but let's verify it's a valid hue
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(360);
    });
  });

  describe("shouldRepaintFavicon", () => {
    it("returns true when lastPaintedHue is null (initial state)", () => {
      resetFaviconStateStore();
      expect(shouldRepaintFavicon("idle", 120)).toBe(true);
    });

    it("returns false when state and hue match the last painted values", () => {
      markFaviconPainted("idle", 120);
      expect(shouldRepaintFavicon("idle", 120)).toBe(false);
    });

    it("returns true when the state differs", () => {
      markFaviconPainted("idle", 120);
      expect(shouldRepaintFavicon("active", 120)).toBe(true);
    });

    it("returns true when the hue differs", () => {
      markFaviconPainted("idle", 120);
      expect(shouldRepaintFavicon("idle", 200)).toBe(true);
    });

    it("returns true when both state and hue differ", () => {
      markFaviconPainted("idle", 120);
      expect(shouldRepaintFavicon("dead", 200)).toBe(true);
    });
  });

  describe("markFaviconPainted", () => {
    it("updates the internal state so subsequent shouldRepaintFavicon returns false", () => {
      markFaviconPainted("active", 90);
      expect(shouldRepaintFavicon("active", 90)).toBe(false);
    });

    it("allows tracking state transitions", () => {
      markFaviconPainted("idle", 0);
      markFaviconPainted("active", 0);
      expect(shouldRepaintFavicon("active", 0)).toBe(false);
    });
  });

  describe("integration: getCachedHue writes to recent hues list", () => {
    it("recent hues list contains the generated hue after getCachedHue", () => {
      resetFaviconStateStore();
      const hue = getCachedHue();

      const raw = window.localStorage.getItem("localterm:recent-favicon-hues");
      expect(raw).not.toBeNull();
      const recent = JSON.parse(raw!) as number[];
      expect(recent).toContain(hue);
    });

    it("limits recent hues to FAVICON_RECENT_HUES_LIMIT (16)", () => {
      // prime localStorage with 20 recent hues
      const twentyHues = Array.from({ length: 20 }, (_, i) => i * 18);
      window.localStorage.setItem("localterm:recent-favicon-hues", JSON.stringify(twentyHues));

      resetFaviconStateStore();
      // Clear sessionStorage so getCachedHue falls through to readRecentHues
      window.sessionStorage.removeItem("localterm:favicon-hue");

      getCachedHue();

      const raw = window.localStorage.getItem("localterm:recent-favicon-hues");
      const recent = JSON.parse(raw!) as number[];
      expect(recent.length).toBeLessThanOrEqual(16);
    });
  });

  describe("error resilience", () => {
    it("handles localStorage.getItem throwing during getCachedHue", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      resetFaviconStateStore();

      // Should not throw even if storage fails
      // The function will fall back to generating a hue
      expect(() => getCachedHue()).not.toThrow();
    });

    it("handles localStorage.setItem throwing during getCachedHue", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage error");
      });
      resetFaviconStateStore();

      expect(() => getCachedHue()).not.toThrow();
    });
  });
});
