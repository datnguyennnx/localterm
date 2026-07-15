import { isLoopbackHost } from "@datnguyennnx/localterm-server";
import { type CliError, cliError } from "../errors.js";
import { clearPid, isAlive, readPid, readPort } from "../state.js";
import { verifyPidIsLocalterm } from "./verify-pid-is-localterm.js";

export const runStartPreflight = async (host: string): Promise<CliError | null> => {
  if (!isLoopbackHost(host)) {
    return cliError.invalidHost(host);
  }
  const existingPid = readPid();
  if (existingPid && isAlive(existingPid)) {
    const verification = await verifyPidIsLocalterm(existingPid);
    if (verification === "not-ours") {
      console.warn("pid file was claiming a non-localterm process; cleaned up");
      clearPid();
      return null;
    }
    const existingPort = readPort();
    if (existingPort === null) {
      return cliError.stalePortFile(existingPid);
    }
    return cliError.alreadyRunning(existingPid, existingPort);
  }
  if (existingPid) clearPid();
  return null;
};
