import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { detectIsAppleWebKit } from "../../src/platform/detect-is-apple-webkit";
import { isCoarsePointer } from "../../src/platform/is-coarse-pointer";

const originalNavigatorVendor = navigator.vendor;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "vendor", {
    configurable: true,
    value: originalNavigatorVendor,
  });
});

describe("mobile environment detection", () => {
  it("limits manual visual viewport handling to Apple WebKit", () => {
    Object.defineProperty(navigator, "vendor", {
      configurable: true,
      value: "Apple Computer, Inc.",
    });
    expect(detectIsAppleWebKit()).toBe(true);

    Object.defineProperty(navigator, "vendor", {
      configurable: true,
      value: "Google Inc.",
    });
    expect(detectIsAppleWebKit()).toBe(false);
  });

  it("uses the coarse pointer media query for touch-focused behavior", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    expect(isCoarsePointer()).toBe(true);

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    expect(isCoarsePointer()).toBe(false);
  });
});
