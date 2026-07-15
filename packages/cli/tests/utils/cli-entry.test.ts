import { describe, expect, it } from "vite-plus/test";
import { cliEntry } from "../../src/utils/cli-entry.js";

describe("cliEntry", () => {
  it("resolves to an absolute path", () => {
    expect(cliEntry).toBeTypeOf("string");
    expect(cliEntry.length).toBeGreaterThan(0);
    expect(cliEntry).toMatch(/^\//);
  });

  it("points to a file named index.js", () => {
    expect(cliEntry).toMatch(/index\.js$/);
  });

  it("contains the cli package dist directory", () => {
    expect(cliEntry).toContain("localterm");
  });
});
