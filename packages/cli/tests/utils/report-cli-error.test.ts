import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cliError, type CliError } from "../../src/errors.js";
import { reportCliError } from "../../src/utils/report-cli-error.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reportCliError", () => {
  it("logs an error-severity message in red with a cross prefix", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const error: CliError = cliError.invalidPort("abc", "expected an integer");

    reportCliError(error);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [message] = logSpy.mock.calls[0] ?? [];
    expect(message).toMatch(/✗/);
    expect(message).toContain("invalid --port 'abc'");
  });

  it("logs a warning-severity message without a cross prefix but with a hint", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const error: CliError = cliError.alreadyRunning(12345, 3417);

    reportCliError(error);

    // alreadyRunning has a hint, so console.log is called twice
    expect(logSpy).toHaveBeenCalledTimes(2);
    const [message] = logSpy.mock.calls[0] ?? [];
    expect(message).not.toMatch(/✗/);
    expect(message).toContain("already running");
  });

  it("appends a hint when the error kind has a known recovery path", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const error: CliError = cliError.stalePortFile(12345);

    reportCliError(error);

    expect(logSpy).toHaveBeenCalledTimes(2);
    const hint = logSpy.mock.calls[1]![0] as string;
    expect(hint).toMatch(/localterm stop/);
  });

  it("does not log a hint when the error kind returns null", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const error: CliError = cliError.serverStartFailed(new Error("EADDRINUSE"));

    reportCliError(error);

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("handles every CliError variant without throwing", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const variants: CliError[] = [
      cliError.invalidPort("abc", "x"),
      cliError.invalidHost("0.0.0.0"),
      cliError.alreadyRunning(1, 3417),
      cliError.stalePortFile(1),
      cliError.daemonSpawnFailed("/n", "/tmp/log"),
      cliError.daemonDied(1, "/tmp/log"),
      cliError.daemonReadyTimeout(1, 5000, "/tmp/log"),
      cliError.serverStartFailed(new Error("x")),
      cliError.pidNotOurs(1),
      cliError.signalFailed(1, new Error("x")),
      cliError.healthCheckFailed(1, 3417, new Error("x")),
    ];

    for (const variant of variants) {
      expect(() => reportCliError(variant)).not.toThrow();
    }

    expect(logSpy).toHaveBeenCalled();
  });
});
