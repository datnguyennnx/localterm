import { isLoopbackHost } from "@datnguyennnx/localterm-server";
import kleur from "kleur";
import { cliError, exitCodeForCliError } from "../errors.js";
import { buildDaemonStartArgs } from "../utils/build-daemon-args.js";
import { reportCliError } from "../utils/report-cli-error.js";
import { spawnDaemonAndWait } from "../utils/spawn-daemon-and-wait.js";
import { runStop } from "./stop.js";
import { type StartOptions, runStartInForeground } from "./start.js";

export interface RestartOptions {
  port: number;
  host: string;
  open: boolean;
  foreground?: boolean;
  yolo?: boolean;
  maxSessions?: number;
}

export const runRestart = async (options: RestartOptions): Promise<void> => {
  if (!isLoopbackHost(options.host)) {
    const error = cliError.invalidHost(options.host);
    reportCliError(error);
    process.exit(exitCodeForCliError(error));
  }
  await runStop();

  if (options.foreground) {
    const startOptions: StartOptions = {
      port: options.port,
      host: options.host,
      open: options.open,
      foreground: true,
      yolo: options.yolo,
      maxSessions: options.maxSessions,
    };
    await runStartInForeground(startOptions);
    return;
  }

  const result = await spawnDaemonAndWait(buildDaemonStartArgs(options));

  if (!result.ok) {
    reportCliError(result.error);
    process.exit(exitCodeForCliError(result.error));
  }

  console.log(
    kleur.green(`✔ restarted (pid ${result.pid}, port ${result.port}, logs: ${result.logPath})`),
  );
};
