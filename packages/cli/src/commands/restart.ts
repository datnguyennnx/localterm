import { isLoopbackHost } from "@datnguyennnx/localterm-server";
import kleur from "kleur";
import { cliError, exitCodeForCliError } from "../errors.js";
import { buildDaemonStartArgs } from "../utils/build-daemon-args.js";
import { reportCliError } from "../utils/report-cli-error.js";
import { spawnDaemonAndWait } from "../utils/spawn-daemon-and-wait.js";
import { runStop } from "./stop.js";

export interface RestartOptions {
  port: number;
  host: string;
  open: boolean;
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

  const result = await spawnDaemonAndWait(buildDaemonStartArgs(options));

  if (!result.ok) {
    reportCliError(result.error);
    process.exit(exitCodeForCliError(result.error));
  }

  console.log(
    kleur.green(`✔ restarted (pid ${result.pid}, port ${result.port}, logs: ${result.logPath})`),
  );
};
