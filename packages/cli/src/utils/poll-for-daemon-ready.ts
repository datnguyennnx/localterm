import { DAEMON_HEALTH_PROBE_TIMEOUT_MS } from "../constants.js";
import { type CliError, cliError } from "../errors.js";

export type DaemonReadyResult = { ok: true; port: number } | { ok: false; error: CliError };

export interface DaemonProbeOptions {
  childPid: number;
  initialPort: number | null;
  intervalMs: number;
  maxWaitMs: number;
  logPath: string;
  isAlive: (pid: number) => boolean;
  readPid: () => number | null;
  readPort: () => number | null;
  sleep: (durationMs: number) => Promise<void>;
  probeHealth?: (port: number) => Promise<boolean>;
}

const defaultProbeHealth = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(DAEMON_HEALTH_PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const pollForDaemonReady = async (
  options: DaemonProbeOptions,
): Promise<DaemonReadyResult> => {
  const probeHealth = options.probeHealth ?? defaultProbeHealth;
  let waited = 0;
  while (waited < options.maxWaitMs) {
    await options.sleep(options.intervalMs);
    waited += options.intervalMs;
    if (!options.isAlive(options.childPid)) {
      return { ok: false, error: cliError.daemonDied(options.childPid, options.logPath) };
    }
    const observedPort = options.readPort();
    if (observedPort !== null && options.readPid() === options.childPid) {
      if (observedPort !== options.initialPort) return { ok: true, port: observedPort };
      if (await probeHealth(observedPort)) return { ok: true, port: observedPort };
    }
  }
  return {
    ok: false,
    error: cliError.daemonReadyTimeout(options.childPid, options.maxWaitMs, options.logPath),
  };
};
