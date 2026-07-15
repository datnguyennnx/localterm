import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../src/utils/spawn-daemon.js", () => ({
  spawnDaemon: vi.fn(),
}));

vi.mock("../../src/utils/poll-for-daemon-ready.js", () => ({
  pollForDaemonReady: vi.fn(),
}));

vi.mock("../../src/state.js", () => ({
  ensureLogFile: vi.fn(),
  isAlive: vi.fn(),
  readPid: vi.fn(),
  readPort: vi.fn(),
}));

const mockOpenSync = vi.fn();
vi.mock("node:fs", () => ({
  default: {
    openSync: mockOpenSync,
  },
  openSync: mockOpenSync,
}));

const { spawnDaemon: spawnDaemonOriginal } = await import("../../src/utils/spawn-daemon.js");
const { pollForDaemonReady: pollForDaemonReadyOriginal } =
  await import("../../src/utils/poll-for-daemon-ready.js");
const { ensureLogFile: ensureLogFileOriginal, readPort: readPortOriginal } =
  await import("../../src/state.js");
const spawnDaemon = vi.mocked(spawnDaemonOriginal);
const pollForDaemonReady = vi.mocked(pollForDaemonReadyOriginal);
const ensureLogFile = vi.mocked(ensureLogFileOriginal);
const readPort = vi.mocked(readPortOriginal);
const { spawnDaemonAndWait } = await import("../../src/utils/spawn-daemon-and-wait.js");

describe("spawnDaemonAndWait", () => {
  it("returns ok with port, pid, and logPath on success", async () => {
    ensureLogFile.mockReturnValue("/tmp/localterm.log");
    mockOpenSync.mockReturnValue(4);
    spawnDaemon.mockReturnValue({ pid: 12345 });
    pollForDaemonReady.mockResolvedValue({ ok: true, port: 5555 });

    const result = await spawnDaemonAndWait(["start", "--port", "5555"]);

    expect(result).toEqual({
      ok: true,
      port: 5555,
      pid: 12345,
      logPath: "/tmp/localterm.log",
    });
  });

  it("returns daemonSpawnFailed CliError when child pid is undefined", async () => {
    ensureLogFile.mockReturnValue("/tmp/localterm.log");
    mockOpenSync.mockReturnValue(4);
    spawnDaemon.mockReturnValue({ pid: undefined });

    const result = await spawnDaemonAndWait(["start"]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("daemon-spawn-failed");
      expect(result.error.code).toBe("E_LT_CLI_DAEMON_SPAWN_FAILED");
    }
  });

  it("forwards a polling failure CliError", async () => {
    ensureLogFile.mockReturnValue("/tmp/localterm.log");
    mockOpenSync.mockReturnValue(4);
    spawnDaemon.mockReturnValue({ pid: 12345 });
    pollForDaemonReady.mockResolvedValue({
      ok: false,
      error: {
        kind: "daemon-ready-timeout",
        code: "E_LT_CLI_DAEMON_READY_TIMEOUT",
        severity: "warning",
        pid: 12345,
        maxWaitMs: 5000,
        logPath: "/tmp/localterm.log",
      },
    });

    const result = await spawnDaemonAndWait(["start"]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("daemon-ready-timeout");
    }
  });

  it("opens the log file in append mode", async () => {
    ensureLogFile.mockReturnValue("/tmp/custom.log");
    spawnDaemon.mockReturnValue({ pid: 12345 });
    pollForDaemonReady.mockResolvedValue({ ok: true, port: 3417 });

    await spawnDaemonAndWait(["start"]);

    expect(mockOpenSync).toHaveBeenCalledWith("/tmp/custom.log", "a");
  });

  it("reads port before spawn and passes it as initialPort", async () => {
    readPort.mockReturnValue(3417);
    ensureLogFile.mockReturnValue("/tmp/localterm.log");
    mockOpenSync.mockReturnValue(4);
    spawnDaemon.mockReturnValue({ pid: 12345 });
    pollForDaemonReady.mockResolvedValue({ ok: true, port: 5555 });

    await spawnDaemonAndWait(["start"]);

    expect(pollForDaemonReady).toHaveBeenCalledWith(expect.objectContaining({ initialPort: 3417 }));
  });

  it("passes the log fd value to spawnDaemon", async () => {
    ensureLogFile.mockReturnValue("/tmp/localterm.log");
    mockOpenSync.mockReturnValue(7);
    spawnDaemon.mockReturnValue({ pid: 12345 });
    pollForDaemonReady.mockResolvedValue({ ok: true, port: 3417 });

    await spawnDaemonAndWait(["start"]);

    expect(spawnDaemon).toHaveBeenCalledWith({ args: ["start"], logFd: 7 });
  });
});
