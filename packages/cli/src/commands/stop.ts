import kleur from "kleur";
import { STOP_MAX_WAIT_MS, STOP_POLL_INTERVAL_MS } from "../constants.js";
import { cliError } from "../errors.js";
import { clearPid, isAlive, readPid } from "../state.js";
import { reportCliError } from "../utils/report-cli-error.js";
import { sleep } from "../utils/sleep.js";
import { verifyPidIsLocalterm } from "../utils/verify-pid-is-localterm.js";

export const runStop = async (): Promise<void> => {
  const pid = readPid();
  if (!pid) {
    console.log(kleur.dim("localterm is not running."));
    return;
  }
  if (!isAlive(pid)) {
    clearPid();
    console.log(kleur.dim("stale pid file removed."));
    return;
  }
  const isOurDaemon = await verifyPidIsLocalterm(pid);
  if (!isOurDaemon) {
    reportCliError(cliError.pidNotOurs(pid));
    clearPid();
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    reportCliError(
      cliError.signalFailed(pid, error instanceof Error ? error : new Error(String(error))),
    );
    return;
  }

  let waited = 0;
  while (isAlive(pid) && waited < STOP_MAX_WAIT_MS) {
    await sleep(STOP_POLL_INTERVAL_MS);
    waited += STOP_POLL_INTERVAL_MS;
  }

  if (isAlive(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* process exited between SIGTERM and SIGKILL */
    }
  }
  clearPid();
  console.log(kleur.green(`✔ stopped pid ${pid}`));
};
