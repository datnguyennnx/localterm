import { describe, expect, it } from "vite-plus/test";
import { formatWorkingDirectoryTitle } from "../../src/utils/format-working-directory-title.js";

const home = "/Users/tester";

describe("formatWorkingDirectoryTitle", () => {
  it("returns ~ when cwd equals the home directory", () => {
    expect(formatWorkingDirectoryTitle(home, home)).toBe("~");
  });

  it("uses zsh-style ~/... abbreviation under home", () => {
    expect(formatWorkingDirectoryTitle("/Users/tester/Developer/localterm", home)).toBe(
      "~/Developer/localterm",
    );
  });

  it("keeps paths with three or fewer display segments whole", () => {
    expect(formatWorkingDirectoryTitle("/usr/local/bin", home)).toBe("/usr/local/bin");
  });

  it("keeps a path at the segment boundary (3 segments) whole", () => {
    expect(formatWorkingDirectoryTitle("/Users/tester/Developer", home)).toBe("~/Developer");
  });

  it("truncates deep paths to the last three display segments", () => {
    expect(
      formatWorkingDirectoryTitle("/Users/tester/Developer/localterm/packages/server", home),
    ).toBe("…/localterm/packages/server");
  });

  it("truncates a path that's exactly one segment over the cap", () => {
    expect(formatWorkingDirectoryTitle("/a/b/c/d", home)).toBe("…/b/c/d");
  });

  it("returns the input unchanged when cwd is empty", () => {
    expect(formatWorkingDirectoryTitle("", home)).toBe("");
  });

  it("handles the root path", () => {
    expect(formatWorkingDirectoryTitle("/", home)).toBe("/");
  });

  it("falls back to the absolute path when cwd is outside home", () => {
    expect(formatWorkingDirectoryTitle("/var/log/system.log", home)).toBe("/var/log/system.log");
  });
});
