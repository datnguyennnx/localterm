import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, DEFAULT_HOST, DEFAULT_PORT } from "@datnguyennnx/localterm-server";
import kleur from "kleur";
import open from "open";
import {
  DAEMON_CHILD_ENV_FLAG,
  DAEMON_PROCESS_TITLE,
  EXIT_FAILURE,
  EXIT_OK,
  FORCE_EXIT_TIMEOUT_MS,
  STOP_COMMAND,
} from "../constants.js";
import { cliError, exitCodeForCliError } from "../errors.js";
import { clearPid, writePid } from "../state.js";
import { buildDaemonStartArgs } from "../utils/build-daemon-args.js";
import { getFriendlyUrl } from "../utils/get-friendly-url.js";
import { reportCliError } from "../utils/report-cli-error.js";
import { runStartPreflight } from "../utils/run-start-preflight.js";
import { spawnDaemonAndWait } from "../utils/spawn-daemon-and-wait.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const resolveStaticRoot = (): string | null => {
  const candidates = [
    path.resolve(moduleDir, "../../../../apps/terminal/dist"),
    path.resolve(moduleDir, "../../terminal"),
    path.resolve(moduleDir, "../terminal"),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.html"))) return candidate;
  }
  return null;
};

export interface StartOptions {
  port: number;
  host: string;
  open: boolean;
  foreground: boolean;
  yolo?: boolean;
  maxSessions?: number;
}

const isRunningAsDaemonChild = (): boolean => process.env[DAEMON_CHILD_ENV_FLAG] === "1";

export const runStart = async (options: StartOptions): Promise<void> => {
  if (options.foreground || isRunningAsDaemonChild()) {
    await runStartInForeground(options);
    return;
  }
  await runStartAsDaemon(options);
};

const runStartAsDaemon = async (options: StartOptions): Promise<void> => {
  const preflightError = await runStartPreflight(options.host);
  if (preflightError !== null) {
    reportCliError(preflightError);
    process.exit(exitCodeForCliError(preflightError));
  }

  const result = await spawnDaemonAndWait(buildDaemonStartArgs(options));

  if (!result.ok) {
    reportCliError(result.error);
    process.exit(exitCodeForCliError(result.error));
  }

  printDaemonStartedBanner(result.port);
  if (options.open) await openInBrowser(getFriendlyUrl(result.port));
};

const printDaemonStartedBanner = (port: number): void => {
  console.log(`${kleur.green("✔")} running at ${kleur.cyan(getFriendlyUrl(port))}`);
  console.log(`  stop with ${kleur.bold(STOP_COMMAND)}`);
};

const openInBrowser = async (url: string): Promise<void> => {
  try {
    await open(url);
  } catch {
    /* headless environments (CI, ssh) have no browser to open; not fatal */
  }
};

export const runStartInForeground = async (options: StartOptions): Promise<void> => {
  const preflightError = await runStartPreflight(options.host);
  if (preflightError !== null) {
    reportCliError(preflightError);
    process.exit(exitCodeForCliError(preflightError));
  }

  process.title = DAEMON_PROCESS_TITLE;

  const staticRoot = resolveStaticRoot();
  if (!staticRoot) {
    console.log(
      kleur.yellow(
        "warning: terminal bundle not found. run 'pnpm build' first or only the API will be served.",
      ),
    );
  }

  let server: Awaited<ReturnType<typeof createServer>>;
  try {
    server = await createServer({
      port: options.port,
      host: options.host,
      staticRoot,
      allowDestructiveCommands: options.yolo ?? false,
      maxConcurrentSessions: options.maxSessions,
    });
  } catch (caughtError) {
    const startError = cliError.serverStartFailed(
      caughtError instanceof Error ? caughtError : new Error(String(caughtError)),
    );
    reportCliError(startError);
    process.exit(exitCodeForCliError(startError));
  }

  writePid(process.pid, server.port);

  const namedUrl = getFriendlyUrl(server.port);
  if (isRunningAsDaemonChild()) {
    console.log(`${kleur.green("✔")} daemon listening on ${namedUrl} (pid ${process.pid})`);
  } else {
    console.log(`${kleur.green("✔")} running at ${kleur.cyan(namedUrl)}`);
    console.log(`  press ${kleur.bold("Ctrl+C")} to stop`);
  }

  if (options.open && !isRunningAsDaemonChild()) await openInBrowser(namedUrl);

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      console.log(kleur.red("force exit"));
      clearPid();
      process.exit(EXIT_FAILURE);
    }
    shuttingDown = true;
    console.log(`\n${kleur.dim(`received ${signal}, shutting down…`)}`);
    const forceExit = setTimeout(() => {
      console.log(kleur.red("forcing exit (server.stop took too long)"));
      clearPid();
      process.exit(EXIT_FAILURE);
    }, FORCE_EXIT_TIMEOUT_MS);
    forceExit.unref();
    let stopOk = false;
    try {
      await server.stop();
      stopOk = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(kleur.red(`stop error: ${message}`));
    } finally {
      clearTimeout(forceExit);
      clearPid();
      process.exit(stopOk ? EXIT_OK : EXIT_FAILURE);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGHUP", () => void shutdown("SIGHUP"));
};

export const startDefaults: StartOptions = {
  port: DEFAULT_PORT,
  host: DEFAULT_HOST,
  open: true,
  foreground: false,
  yolo: false,
};
