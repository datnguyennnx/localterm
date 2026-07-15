import { describe, expect, it } from "vite-plus/test";
import { extractKeyboardModifiers } from "../../src/utils/extract-keyboard-modifiers";

const createKeyboardEvent = (modifiers: {
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): KeyboardEvent =>
  ({
    shiftKey: modifiers.shiftKey ?? false,
    altKey: modifiers.altKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
  }) as KeyboardEvent;

describe("extractKeyboardModifiers", () => {
  it("returns 0 when no modifiers are pressed", () => {
    expect(extractKeyboardModifiers(createKeyboardEvent({}))).toBe(0);
  });

  it("returns SHIFT_BIT (1) when shift is pressed", () => {
    expect(extractKeyboardModifiers(createKeyboardEvent({ shiftKey: true }))).toBe(1);
  });

  it("returns ALT_BIT (2) when alt is pressed", () => {
    expect(extractKeyboardModifiers(createKeyboardEvent({ altKey: true }))).toBe(2);
  });

  it("returns CTRL_BIT (4) when ctrl is pressed", () => {
    expect(extractKeyboardModifiers(createKeyboardEvent({ ctrlKey: true }))).toBe(4);
  });

  it("returns META_BIT (8) when meta is pressed", () => {
    expect(extractKeyboardModifiers(createKeyboardEvent({ metaKey: true }))).toBe(8);
  });

  it("combines shift+alt bits (1 | 2 = 3)", () => {
    expect(
      extractKeyboardModifiers(createKeyboardEvent({ shiftKey: true, altKey: true })),
    ).toBe(3);
  });

  it("combines ctrl+meta bits (4 | 8 = 12)", () => {
    expect(
      extractKeyboardModifiers(createKeyboardEvent({ ctrlKey: true, metaKey: true })),
    ).toBe(12);
  });

  it("combines all four modifiers (1 | 2 | 4 | 8 = 15)", () => {
    expect(
      extractKeyboardModifiers(
        createKeyboardEvent({
          shiftKey: true,
          altKey: true,
          ctrlKey: true,
          metaKey: true,
        }),
      ),
    ).toBe(15);
  });
});
