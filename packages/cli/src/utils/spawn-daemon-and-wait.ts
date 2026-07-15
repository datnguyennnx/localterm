import { openSync } from "node:fs";
import { DAEMON_PROBE_INTERVAL_MS, DAEMON_PROBE_MAX_WAIT_MS } from "../constants.js";
import { type CliError, cliError } from "../errors.js";
import { ensureLogFile, isAlive, readPid, readPort } from "../state.js";
import { pollForDaemonReady } from "./poll-for-daemon-ready.js";
import { sleep } from "./sleep.js";
import { spawnDaemon } from "./spawn-daemon.js";

export type DaemonSpawnResult =
  | { ok: true; port: number; pid: number; logPath: string }
  | { ok: false; error: CliError };

export const spawnDaemonAndWait = async (
  args: string[],
): Promise<DaemonSpawnResult> => {
  const portBeforeSpawn = readPort();
  const logPath = ensureLogFile();
  const logFd = openSync(logPath, "a");
  const { pid: childPid } = spawnDaemon({ args, logFd });

  if (childPid === undefined) {
    return { ok: false, error: cliError.daemonSpawnFailed(process.execPath, logPath) };
  }

  const result = await pollForDaemonReady({
    childPid,
    initialPort: portBeforeSpawn,
    intervalMs: DAEMON_PROBE_INTERVAL_MS,
    maxWaitMs: DAEMON_PROBE_MAX_WAIT_MS,
    logPath,
    isAlive,
    readPid,
    readPort,
    sleep,
  });

  if (result.ok) {
    return { ok: true, port: result.port, pid: childPid, logPath };
  }

  return { ok: false, error: result.error };
};
