import { describe, expect, it, vi } from "vite-plus/test";
import { pollForDaemonReady } from "../../src/utils/poll-for-daemon-ready.js";

const noopSleep = (): Promise<void> => Promise.resolve();
const neverHealthy = (): Promise<boolean> => Promise.resolve(false);
const alwaysHealthy = (): Promise<boolean> => Promise.resolve(true);

const STANDARD_OPTIONS = {
  childPid: 12345,
  intervalMs: 10,
  maxWaitMs: 100,
  logPath: "/tmp/localterm.log",
  readPid: () => 12345,
  probeHealth: neverHealthy,
};

describe("pollForDaemonReady", () => {
  it("resolves with the new port once a different value appears", async () => {
    let tick = 0;
    const result = await pollForDaemonReady({
      ...STANDARD_OPTIONS,
      initialPort: null,
      isAlive: () => true,
      readPort: () => {
        tick += 1;
        return tick < 3 ? null : 4242;
      },
      probeHealth: alwaysHealthy,
      sleep: noopSleep,
    });
    expect(result).toEqual({ ok: true, port: 4242 });
  });

  it("keeps polling when health check fails and only accepts after it passes", async () => {
    let probeCount = 0;
    const result = await pollForDaemonReady({
      ...STANDARD_OPTIONS,
      initialPort: null,
      isAlive: () => true,
      readPort: () => 3417,
      readPid: () => 12345,
      probeHealth: async () => {
        probeCount += 1;
        return probeCount >= 3;
      },
      sleep: noopSleep,
    });
    expect(result).toEqual({ ok: true, port: 3417 });
    expect(probeCount).toBe(3);
  });

  it("returns a daemon-died CliError when the child process disappears mid-poll", async () => {
    let tick = 0;
    const result = await pollForDaemonReady({
      ...STANDARD_OPTIONS,
      initialPort: null,
      isAlive: () => {
        tick += 1;
        return tick < 3;
      },
      readPort: () => null,
      sleep: noopSleep,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("daemon-died");
      expect(result.error.code).toBe("E_LT_CLI_DAEMON_DIED");
    }
  });

  it("returns a daemon-ready-timeout CliError when the deadline expires without a fresh port", async () => {
    const result = await pollForDaemonReady({
      ...STANDARD_OPTIONS,
      initialPort: null,
      isAlive: () => true,
      readPort: () => null,
      sleep: noopSleep,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("daemon-ready-timeout");
      expect(result.error.code).toBe("E_LT_CLI_DAEMON_READY_TIMEOUT");
    }
  });

  it("resolves immediately on the first tick when a fresh port is already present and healthy", async () => {
    const isAlive = vi.fn(() => true);
    const readPort = vi.fn(() => 7777);
    const result = await pollForDaemonReady({
      ...STANDARD_OPTIONS,
      initialPort: null,
      isAlive,
      readPort,
      probeHealth: alwaysHealthy,
      sleep: noopSleep,
    });
    expect(result).toEqual({ ok: true, port: 7777 });
    expect(isAlive).toHaveBeenCalledOnce();
    expect(readPort).toHaveBeenCalledOnce();
  });

  it("polls roughly maxWaitMs / intervalMs times before timing out", async () => {
    const sleepSpy = vi.fn(noopSleep);
    await pollForDaemonReady({
      childPid: 1,
      initialPort: null,
      intervalMs: 10,
      maxWaitMs: 100,
      logPath: "/tmp/localterm.log",
      isAlive: () => true,
      readPid: () => 1,
      readPort: () => null,
      sleep: sleepSpy,
      probeHealth: neverHealthy,
    });
    expect(sleepSpy).toHaveBeenCalledTimes(10);
  });

  it("accepts a healthy same-port daemon only when state belongs to the spawned child", async () => {
    const result = await pollForDaemonReady({
      ...STANDARD_OPTIONS,
      initialPort: 3417,
      isAlive: () => true,
      readPort: () => 3417,
      probeHealth: alwaysHealthy,
      sleep: noopSleep,
    });
    expect(result).toEqual({ ok: true, port: 3417 });
  });

  it("rejects healthy same-port state owned by another pid", async () => {
    const result = await pollForDaemonReady({
      ...STANDARD_OPTIONS,
      initialPort: 3417,
      isAlive: () => true,
      readPid: () => 99999,
      readPort: () => 3417,
      probeHealth: alwaysHealthy,
      sleep: noopSleep,
    });
    expect(result.ok).toBe(false);
  });
});
