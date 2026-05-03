import { describe, expect, it } from "vitest";
import { getFriendlyUrl } from "./constants.js";

describe("getFriendlyUrl", () => {
  it("formats the named-host URL with the bound port", () => {
    expect(getFriendlyUrl(3417)).toBe("http://localterm.localhost:3417");
  });
});
