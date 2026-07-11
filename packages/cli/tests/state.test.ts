import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { isAlive } from "../src/state.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isAlive", () => {
  it("treats a successful signal zero probe as alive", () => {
    vi.spyOn(process, "kill").mockReturnValue(true);
    expect(isAlive(12345)).toBe(true);
  });

  it("treats EPERM as alive", () => {
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("operation not permitted"), { code: "EPERM" });
    });
    expect(isAlive(12345)).toBe(true);
  });

  it("treats other signal errors as dead", () => {
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("no such process"), { code: "ESRCH" });
    });
    expect(isAlive(12345)).toBe(false);
  });
});
