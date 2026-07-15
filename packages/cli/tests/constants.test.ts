import { describe, expect, it } from "vite-plus/test";
import { getFriendlyUrl } from "../src/utils/get-friendly-url.js";

describe("getFriendlyUrl", () => {
  it("formats the named-host URL with the bound port", () => {
    expect(getFriendlyUrl(3417)).toBe("http://localterm.localhost:3417");
  });
});
