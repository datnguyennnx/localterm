import { describe, expect, it, vi } from "vite-plus/test";
import { DAEMON_CHILD_ENV_FLAG } from "../../src/constants.js";

const mockSpawn = vi.fn();

vi.mock("node:child_process", () => ({
  default: {
    spawn: mockSpawn,
  },
  spawn: mockSpawn,
}));

const { spawnDaemon } = await import("../../src/utils/spawn-daemon.js");

describe("spawnDaemon", () => {
  it("spawns a detached child with the cli entry, args, and log fd", () => {
    mockSpawn.mockReturnValue({ pid: 98765, unref: vi.fn() });

    const handle = spawnDaemon({ args: ["start", "--port", "3417"], logFd: 3 });

    expect(handle.pid).toBe(98765);
    expect(mockSpawn).toHaveBeenCalled();
  });

  it("passes DAEMON_CHILD_ENV_FLAG in the environment", () => {
    mockSpawn.mockReturnValue({ pid: 123, unref: vi.fn() });

    spawnDaemon({ args: ["start"], logFd: 3 });

    const callArgs = mockSpawn.mock.calls[0]!;
    const options = callArgs[2] as { env: Record<string, string> };
    expect(options.env[DAEMON_CHILD_ENV_FLAG]).toBe("1");
  });

  it("uses detached mode and redirects stdio to the log fd", () => {
    mockSpawn.mockReturnValue({ pid: 123, unref: vi.fn() });
    mockSpawn.mockClear();

    spawnDaemon({ args: ["start"], logFd: 5 });

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const callArgs = mockSpawn.mock.calls[0]!;
    const options = callArgs[2] as { detached: boolean; stdio: Array<unknown> };
    expect(options.detached).toBe(true);
    expect(options.stdio).toEqual(["ignore", 5, 5]);
  });

  it("calls unref on the spawned child", () => {
    const unref = vi.fn();
    mockSpawn.mockReturnValue({ pid: 123, unref });

    spawnDaemon({ args: [], logFd: 1 });

    expect(unref).toHaveBeenCalledOnce();
  });

  it("forwards process.env as the base environment", () => {
    mockSpawn.mockReturnValue({ pid: 123, unref: vi.fn() });

    spawnDaemon({ args: [], logFd: 1 });

    const callArgs = mockSpawn.mock.calls[0]!;
    const options = callArgs[2] as { env: Record<string, string> };
    expect(options.env).toMatchObject(process.env);
  });

  it("returns pid undefined when child has no pid", () => {
    mockSpawn.mockReturnValue({ pid: undefined, unref: vi.fn() });

    const handle = spawnDaemon({ args: [], logFd: 1 });

    expect(handle.pid).toBeUndefined();
  });
});
