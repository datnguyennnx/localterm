import { describe, expect, it } from "vite-plus/test";
import { getFriendlyUrl } from "../../src/utils/get-friendly-url.js";

describe("getFriendlyUrl", () => {
  it("formats the named-host URL with the bound port", () => {
    expect(getFriendlyUrl(3417)).toBe("http://localterm.localhost:3417");
  });

  it("formats a non-default port", () => {
    expect(getFriendlyUrl(8080)).toBe("http://localterm.localhost:8080");
  });

  it("formats port zero", () => {
    expect(getFriendlyUrl(0)).toBe("http://localterm.localhost:0");
  });

  it("formats the maximum TCP port", () => {
    expect(getFriendlyUrl(65535)).toBe("http://localterm.localhost:65535");
  });
});
