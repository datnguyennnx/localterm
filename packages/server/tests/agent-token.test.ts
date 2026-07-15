import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

// Mock filesystem and os modules before importing the module under test.
// The module's cachedToken is module-scoped and persists across tests within
// this file, so tests are ordered carefully to account for that.

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/fake/home"),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

// Dynamic import helper — returns a fresh module instance so the module-level
// cachedToken starts as null in every test.
const freshTokenModule = async () => {
  vi.resetModules();
  return import("../src/agent/token.js");
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateAgentToken (no token loaded)", () => {
  it("returns false when no token has been cached yet", async () => {
    const { validateAgentToken: validate } = await freshTokenModule();
    expect(validate("anything")).toBe(false);
  });
});

describe("loadOrCreateAgentToken", () => {
  it("generates a new token when the token file does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    // mkdirSync returns undefined on success when recursive is true
    vi.mocked(mkdirSync).mockReturnValue(undefined as unknown as string);
    vi.mocked(writeFileSync).mockReturnValue(undefined as unknown as void);

    const { loadOrCreateAgentToken: load } = await freshTokenModule();
    const token = load();
    expect(token).toBeTypeOf("string");
    expect(token.length).toBeGreaterThan(0);

    // Should create the .localterm directory
    expect(mkdirSync).toHaveBeenCalledWith("/fake/home/.localterm", {
      recursive: true,
      mode: 0o755,
    });
    // Should write the token with restricted permissions
    expect(writeFileSync).toHaveBeenCalledWith(
      "/fake/home/.localterm/agent-token",
      `${token}\n`,
      { mode: 0o600, encoding: "utf-8" },
    );
  });

  it("reads token from existing file", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("saved-token-value\n");

    const { loadOrCreateAgentToken: load } = await freshTokenModule();
    const token = load();
    expect(token).toBe("saved-token-value");
    // Should NOT create directory or write file
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("returns the cached token on subsequent calls without touching fs", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("saved-token-value\n");

    const { loadOrCreateAgentToken: load } = await freshTokenModule();
    // First call reads from file (cachedToken was null)
    const token1 = load();
    expect(token1).toBe("saved-token-value");
    expect(readFileSync).toHaveBeenCalledTimes(1);

    // Clear mock call history so we can verify no second call
    vi.clearAllMocks();

    // Second call should return cached value without touching fs
    const token2 = load();
    expect(token2).toBe("saved-token-value");

    expect(existsSync).not.toHaveBeenCalled();
    expect(readFileSync).not.toHaveBeenCalled();
  });
});

describe("validateAgentToken", () => {
  it("returns true when candidate matches the cached token", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("saved-token-value\n");

    const { loadOrCreateAgentToken: load, validateAgentToken: validate } =
      await freshTokenModule();
    // Pre-load so cachedToken is set
    load();

    expect(validate("saved-token-value")).toBe(true);
  });

  it("returns false when candidate does not match", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("some-token\n");

    const { loadOrCreateAgentToken: load, validateAgentToken: validate } =
      await freshTokenModule();
    load();

    expect(validate("wrong-token")).toBe(false);
    expect(validate("")).toBe(false);
  });
});

describe("getAgentTokenPath", () => {
  it("returns the path to the token file", async () => {
    const { getAgentTokenPath: getPath } = await freshTokenModule();
    const path = getPath();
    expect(path).toBe("/fake/home/.localterm/agent-token");
  });

  it("returns a string ending with agent-token", async () => {
    const { getAgentTokenPath: getPath } = await freshTokenModule();
    const path = getPath();
    expect(path.endsWith("agent-token")).toBe(true);
  });
});
