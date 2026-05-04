import { type CliError, cliError } from "../errors.js";

export type DaemonReadyResult = { ok: true; port: number } | { ok: false; error: CliError };

export interface DaemonProbeOptions {
  childPid: number;
  initialPort: number | null;
  intervalMs: number;
  maxWaitMs: number;
  logPath: string;
  isAlive: (pid: number) => boolean;
  readPort: () => number | null;
  sleep: (durationMs: number) => Promise<void>;
}

export const pollForDaemonReady = async (
  options: DaemonProbeOptions,
): Promise<DaemonReadyResult> => {
  let waited = 0;
  while (waited < options.maxWaitMs) {
    await options.sleep(options.intervalMs);
    waited += options.intervalMs;
    if (!options.isAlive(options.childPid)) {
      return { ok: false, error: cliError.daemonDied(options.childPid, options.logPath) };
    }
    const observedPort = options.readPort();
    if (observedPort !== null && observedPort !== options.initialPort) {
      return { ok: true, port: observedPort };
    }
  }
  return {
    ok: false,
    error: cliError.daemonReadyTimeout(options.childPid, options.maxWaitMs, options.logPath),
  };
};
