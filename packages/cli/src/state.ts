import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { getLogFile, getPidFile, getPortFile, getStateDirectory } from "./paths.js";

export const ensureStateDirectory = (): void => {
  const stateDirectory = getStateDirectory();
  if (!existsSync(stateDirectory)) {
    mkdirSync(stateDirectory, { recursive: true });
  }
};

export const ensureLogFile = (): string => {
  ensureStateDirectory();
  const logFile = getLogFile();
  if (!existsSync(logFile)) {
    writeFileSync(logFile, "", "utf8");
  }
  return logFile;
};

export const writePid = (pid: number, port: number): void => {
  ensureStateDirectory();
  const pidFile = getPidFile();
  const portFile = getPortFile();
  const temporaryPidFile = `${pidFile}.tmp`;
  const temporaryPortFile = `${portFile}.tmp`;
  writeFileSync(temporaryPidFile, String(pid), "utf8");
  writeFileSync(temporaryPortFile, String(port), "utf8");
  renameSync(temporaryPidFile, pidFile);
  renameSync(temporaryPortFile, portFile);
};

export const clearPid = (): void => {
  for (const file of [getPidFile(), getPortFile()]) {
    rmSync(file, { force: true });
  }
};

export const readPid = (): number | null => {
  const pidFile = getPidFile();
  if (!existsSync(pidFile)) return null;
  const raw = readFileSync(pidFile, "utf8").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const readPort = (): number | null => {
  const portFile = getPortFile();
  if (!existsSync(portFile)) return null;
  const raw = readFileSync(portFile, "utf8").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "EPERM") {
      return true;
    }
    return false;
  }
};
