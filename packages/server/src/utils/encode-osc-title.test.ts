import { describe, expect, it } from "vitest";
import { encodeOscTitle } from "./encode-osc-title.js";

describe("encodeOscTitle", () => {
  it("wraps the title in OSC 2 + BEL", () => {
    expect(encodeOscTitle("vim")).toBe("\x1b]2;vim\x07");
  });

  it("preserves unicode and spaces", () => {
    expect(encodeOscTitle("~/Developer/localterm")).toBe("\x1b]2;~/Developer/localterm\x07");
  });

  it("strips control characters that would terminate or corrupt the OSC", () => {
    expect(encodeOscTitle("vim\x07injected")).toBe("\x1b]2;viminjected\x07");
    expect(encodeOscTitle("vim\x1b]0;evil\x07")).toBe("\x1b]2;vim]0;evil\x07");
  });

  it("preserves an empty title (consumer can choose to skip)", () => {
    expect(encodeOscTitle("")).toBe("\x1b]2;\x07");
  });
});
