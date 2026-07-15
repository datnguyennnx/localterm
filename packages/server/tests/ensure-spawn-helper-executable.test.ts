import { describe, expect, it, vi, beforeEach } from "vite-plus/test";

// Hoist shared mocks so they are available in vi.mock factory functions
const { mockResolve } = vi.hoisted(() => ({
  mockResolve: vi.fn(),
}));

// Mock node:module so createRequire returns a controllable resolver
vi.mock("node:module", () => ({
  createRequire: vi.fn(() => ({
    resolve: mockResolve,
  })),
}));

// Mock node:fs to control file system interactions
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  chmodSync: vi.fn(),
}));

import { existsSync, chmodSync } from "node:fs";

// Use dynamic imports to get a fresh module instance per test, ensuring the
// internal hasEnsuredSpawnHelper flag starts as false every time.
const freshMod = () => import("../src/session/ensure-spawn-helper-executable.js");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("ensureSpawnHelperExecutable", () => {
  it("makes the spawn-helper executable at the build/Release path", async () => {
    mockResolve.mockReturnValue("/app/node_modules/node-pty/lib/index.js");
    vi.mocked(existsSync).mockImplementation(
      (p) => p === "/app/node_modules/node-pty/build/Release/spawn-helper",
    );

    const mod = await freshMod();
    mod.ensureSpawnHelperExecutable();

    expect(chmodSync).toHaveBeenCalledWith(
      "/app/node_modules/node-pty/build/Release/spawn-helper",
      0o755,
    );
  });

  it("makes the spawn-helper executable at the prebuilds path", async () => {
    mockResolve.mockReturnValue("/app/node_modules/node-pty/lib/index.js");
    const prebuildPath = `/app/node_modules/node-pty/prebuilds/${process.platform}-${process.arch}/spawn-helper`;
    vi.mocked(existsSync).mockImplementation((p) => p === prebuildPath);

    const mod = await freshMod();
    mod.ensureSpawnHelperExecutable();

    expect(chmodSync).toHaveBeenCalledWith(prebuildPath, 0o755);
  });

  it("handles both paths existing", async () => {
    mockResolve.mockReturnValue("/app/node_modules/node-pty/lib/index.js");
    vi.mocked(existsSync).mockReturnValue(true);

    const mod = await freshMod();
    mod.ensureSpawnHelperExecutable();

    expect(chmodSync).toHaveBeenCalledTimes(2);
    expect(chmodSync).toHaveBeenCalledWith(
      "/app/node_modules/node-pty/build/Release/spawn-helper",
      0o755,
    );
  });

  it("does nothing when neither path exists", async () => {
    mockResolve.mockReturnValue("/app/node_modules/node-pty/lib/index.js");
    vi.mocked(existsSync).mockReturnValue(false);

    const mod = await freshMod();
    mod.ensureSpawnHelperExecutable();

    expect(chmodSync).not.toHaveBeenCalled();
  });

  it("does nothing when node-pty cannot be resolved", async () => {
    mockResolve.mockImplementation(() => {
      throw new Error("module not found");
    });

    const mod = await freshMod();
    expect(() => mod.ensureSpawnHelperExecutable()).not.toThrow();
    expect(existsSync).not.toHaveBeenCalled();
    expect(chmodSync).not.toHaveBeenCalled();
  });

  it("tolerates chmod failures gracefully", async () => {
    mockResolve.mockReturnValue("/app/node_modules/node-pty/index.js");
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(chmodSync).mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const mod = await freshMod();
    expect(() => mod.ensureSpawnHelperExecutable()).not.toThrow();
  });

  it("is a no-op on subsequent calls (cached flag)", async () => {
    mockResolve.mockReturnValue("/app/node_modules/node-pty/index.js");
    vi.mocked(existsSync).mockReturnValue(true);

    const mod = await freshMod();

    // First call should execute and set the internal flag
    mod.ensureSpawnHelperExecutable();
    expect(chmodSync).toHaveBeenCalledTimes(2);

    // Clear mock call history
    vi.clearAllMocks();

    // Second call should be a no-op due to internal hasEnsuredSpawnHelper flag
    mod.ensureSpawnHelperExecutable();
    expect(mockResolve).not.toHaveBeenCalled();
    expect(existsSync).not.toHaveBeenCalled();
    expect(chmodSync).not.toHaveBeenCalled();
  });
});
