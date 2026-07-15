import path from "node:path";
import { describe, expect, it, vi } from "vite-plus/test";

const fakeHome = "/home/testuser";

vi.mock("node:os", () => ({
  default: {
    homedir: vi.fn(() => fakeHome),
  },
  homedir: vi.fn(() => fakeHome),
}));

// Re-import after mocking to capture the mocked homedir
const { getLogFile, getPidFile, getPortFile, getStateDirectory } =
  await import("../src/paths.js");

describe("paths", () => {
  it("getStateDirectory returns ~/.localterm", () => {
    expect(getStateDirectory()).toBe(path.join(fakeHome, ".localterm"));
  });

  it("getPidFile returns the pid file path under the state directory", () => {
    expect(getPidFile()).toBe(path.join(fakeHome, ".localterm", "server.pid"));
  });

  it("getPortFile returns the port file path under the state directory", () => {
    expect(getPortFile()).toBe(path.join(fakeHome, ".localterm", "server.port"));
  });

  it("getLogFile returns the log file path under the state directory", () => {
    expect(getLogFile()).toBe(path.join(fakeHome, ".localterm", "server.log"));
  });

  it("all paths share the same state directory", () => {
    const stateDir = getStateDirectory();
    expect(getPidFile()).toContain(stateDir);
    expect(getPortFile()).toContain(stateDir);
    expect(getLogFile()).toContain(stateDir);
  });
});
