import os from "node:os";
import path from "node:path";

const STATE_DIR = path.join(os.homedir(), ".localterm");

export const getStateDirectory = (): string => STATE_DIR;
export const getPidFile = (): string => path.join(STATE_DIR, "server.pid");
export const getPortFile = (): string => path.join(STATE_DIR, "server.port");
export const getLogFile = (): string => path.join(STATE_DIR, "server.log");
