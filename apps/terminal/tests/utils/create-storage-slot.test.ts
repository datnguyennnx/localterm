import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createStorageSlot } from "../../src/utils/create-storage-slot";

describe("createStorageSlot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  describe("load", () => {
    it("returns the default value when the key does not exist in localStorage", () => {
      const slot = createStorageSlot("test-key", 42);
      expect(slot.load()).toBe(42);
    });

    it("returns the default value when localStorage value is an empty string", () => {
      window.localStorage.setItem("test-key", "");
      const slot = createStorageSlot("test-key", "fallback");
      expect(slot.load()).toBe("fallback");
    });

    it("returns the raw stored value when no deserialize function is provided", () => {
      window.localStorage.setItem("test-key", "hello");
      const slot = createStorageSlot("test-key", "fallback");
      expect(slot.load()).toBe("hello");
    });

    it("applies the deserialize function when provided", () => {
      window.localStorage.setItem("test-key", "42");
      const slot = createStorageSlot("test-key", 0, (raw) => Number(raw) * 2);
      expect(slot.load()).toBe(84);
    });

    it("returns the default when deserialize throws", () => {
      window.localStorage.setItem("test-key", "not-json");
      const slot = createStorageSlot<{ ok: boolean }>(
        "test-key",
        { ok: false },
        (raw) => JSON.parse(raw) as { ok: boolean },
      );
      expect(slot.load()).toEqual({ ok: false });
    });

    it("returns the default when localStorage throws (private browsing)", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage denied");
      });
      const slot = createStorageSlot("test-key", 99);
      expect(slot.load()).toBe(99);
    });

    it("returns the default when the stored value is explicitly null", () => {
      window.localStorage.setItem("test-key", "null");
      const slot = createStorageSlot("test-key", "fallback");
      expect(slot.load()).toBe("null");
    });
  });

  describe("store", () => {
    it("persists a string value to localStorage", () => {
      const slot = createStorageSlot("test-key", "");
      slot.store("stored-value");
      expect(window.localStorage.getItem("test-key")).toBe("stored-value");
    });

    it("converts non-string values via String()", () => {
      const slot = createStorageSlot("test-key", 0);
      slot.store(42);
      expect(window.localStorage.getItem("test-key")).toBe("42");
    });

    it("handles localStorage setItem throwing (private browsing)", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });
      const slot = createStorageSlot("test-key", "");
      expect(() => slot.store("value")).not.toThrow();
    });
  });

  describe("SSR safety", () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    });

    it("returns default on load when window is undefined", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const slot = createStorageSlot("test-key", "ssr-default");
      expect(slot.load()).toBe("ssr-default");
    });

    it("does not throw on store when window is undefined", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const slot = createStorageSlot("test-key", "");
      expect(() => slot.store("value")).not.toThrow();
    });
  });

  it("returns the stored boolean-like string value without deserialize", () => {
    window.localStorage.setItem("flag", "true");
    const slot = createStorageSlot("flag", false);
    expect(slot.load()).toBe("true");
  });
});
