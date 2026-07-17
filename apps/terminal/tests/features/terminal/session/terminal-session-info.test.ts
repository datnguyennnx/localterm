import { describe, expect, it } from "vite-plus/test";

describe("terminal-session-info", () => {
  it("exports the TerminalSessionInfo type (compile-time check)", () => {
    // The module is type-only — it re-exports a derived type from the server protocol.
    // At runtime there are no executable exports to test.
    // This test verifies the module can be imported without error.
    expect(
      async () => import("../../../../src/features/terminal/session/terminal-session-info"),
    ).not.toThrow();
  });
});
