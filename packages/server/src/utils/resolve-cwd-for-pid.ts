import { execFile } from "node:child_process";
import { readlink } from "node:fs/promises";
import { promisify } from "node:util";
import { CWD_RESOLVE_TIMEOUT_MS } from "../constants.js";

const execFileAsync = promisify(execFile);

export const resolveCwdForPid = async (pid: number): Promise<string | null> => {
  if (!Number.isFinite(pid) || pid <= 0) return null;
  if (process.platform === "linux") {
    try {
      return await readlink(`/proc/${pid}/cwd`);
    } catch {
      return null;
    }
  }
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync(
        "lsof",
        ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
        { timeout: CWD_RESOLVE_TIMEOUT_MS, windowsHide: true },
      );
      const cwdLine = stdout.split("\n").find((line) => line.startsWith("n"));
      return cwdLine ? cwdLine.slice(1) : null;
    } catch {
      return null;
    }
  }
  return null;
};
