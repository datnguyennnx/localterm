import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { registerServiceWorker } from "../../src/utils/register-service-worker";

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("registerServiceWorker", () => {
  it("registers the generated worker at the root scope in production", () => {
    const register = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    registerServiceWorker(false);

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("does not register a worker during development", () => {
    const register = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    registerServiceWorker(true);

    expect(register).not.toHaveBeenCalled();
  });
});
