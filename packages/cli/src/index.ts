import { DEFAULT_HOST, DEFAULT_PORT } from "@datnguyennnx/localterm-server";
import { Command } from "commander";
import { runRestart } from "./commands/restart.js";
import { runStart } from "./commands/start.js";
import { runStatus } from "./commands/status.js";
import { runStop } from "./commands/stop.js";
import { parsePortOption } from "./utils/parse-port-option.js";
import { readPackageVersion } from "./utils/read-package-version.js";

let initialPort: number;
try {
  initialPort = parsePortOption(process.env.PORT ?? String(DEFAULT_PORT));
} catch {
  initialPort = DEFAULT_PORT;
}

const program = new Command();
program
  .name("localterm")
  .description("local browser-based terminal hub")
  .version(readPackageVersion());

program
  .command("start")
  .description("start the localterm server (daemonizes by default)")
  .option("-p, --port <port>", "port to bind", parsePortOption, initialPort)
  .option("-H, --host <host>", "host to bind", DEFAULT_HOST)
  .option("--no-open", "do not open browser on start")
  .option("-F, --foreground", "stay attached to this terminal (do not daemonize)", false)
  .option("--yolo", "allow destructive commands in agent mode (bypass denylist)", false)
  .option("--max-sessions <count>", "maximum concurrent sessions", parseInt, undefined)
  .action(
    async (options: {
      port: number;
      host: string;
      open: boolean;
      foreground: boolean;
      yolo: boolean;
      maxSessions?: number;
    }) => {
      await runStart({
        port: options.port,
        host: options.host,
        open: options.open,
        foreground: options.foreground,
        yolo: options.yolo,
        maxSessions: options.maxSessions,
      });
    },
  );

program
  .command("stop")
  .description("stop the localterm server")
  .action(async () => {
    await runStop();
  });

program
  .command("status")
  .description("show server status")
  .action(async () => {
    await runStatus();
  });

program
  .command("restart")
  .description("restart the localterm server")
  .option("-p, --port <port>", "port to bind", parsePortOption, initialPort)
  .option("-H, --host <host>", "host to bind", DEFAULT_HOST)
  .option("--no-open", "do not open browser on start")
  .option("--yolo", "allow destructive commands in agent mode (bypass denylist)", false)
  .option("--max-sessions <count>", "maximum concurrent sessions", parseInt, undefined)
  .action(
    async (options: {
      port: number;
      host: string;
      open: boolean;
      yolo: boolean;
      maxSessions?: number;
    }) => {
      await runRestart({
        port: options.port,
        host: options.host,
        open: options.open,
        yolo: options.yolo,
        maxSessions: options.maxSessions,
      });
    },
  );

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
