import fs from "node:fs";
import path from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  HTTP_STATUS_NOT_FOUND,
  MAX_CONCURRENT_SESSIONS,
  SERVER_STOP_GRACE_MS,
  WS_BACKPRESSURE_THRESHOLD_BYTES,
  WS_CLOSE_BACKPRESSURE,
  WS_CLOSE_CAPACITY_REACHED,
  WS_CLOSE_POLICY_VIOLATION,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_OUTBOUND_DRAIN_POLL_MS,
  WS_OUTBOUND_PAUSE_HIGH_WATER_BYTES,
  WS_OUTBOUND_RESUME_LOW_WATER_BYTES,
  WS_READY_STATE_OPEN,
} from "../constants.js";
import { ServerErrorException, serverError } from "../errors.js";
import { clientToServerMessageSchema } from "../schemas.js";
import { enforceLoopback, isLoopbackHost, loopbackMiddleware } from "./security.js";
import { OutputBatcher } from "../output-batcher.js";
import { Session } from "../session/session.js";
import { SessionRegistry } from "../session/session-registry.js";
import { resolveStaticAsset } from "./static-resolver.js";
import type { ServerToClientMessage } from "../types.js";
import { getHeartbeatAction } from "../utils/get-heartbeat-action.js";
import { SHELL_INTEGRATION_ENV_VAR } from "../shell-integration/index.js";
import { validateAgentToken, loadOrCreateAgentToken } from "../agent/token.js";
import { handleRpcRequest } from "../agent/rpc.js";
import { stripAnsi } from "../parser/strip-ansi.js";

export interface ServerOptions {
  port?: number;
  host?: string;
  staticRoot?: string | null;
  agentToken?: string;
  allowDestructiveCommands?: boolean;
  maxConcurrentSessions?: number;
}

export interface RunningServer {
  port: number;
  host: string;
  registry: SessionRegistry;
  stop: () => Promise<void>;
}

interface BroadcastSocket {
  readyState: number;
  send: (source: string | ArrayBuffer | Uint8Array<ArrayBuffer>) => void;
  close: (code?: number, reason?: string) => void;
  raw?: unknown;
}

const REVALIDATED_STATIC_PATHS = new Set(["/sw.js", "/manifest.webmanifest"]);

const DEV_MODE_REDIRECT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="1;url=http://localhost:5174" />
</head>
</html>`;

const getRawBufferedAmount = (raw: unknown): number => {
  if (!raw || typeof raw !== "object") return 0;
  const candidate = Reflect.get(raw, "bufferedAmount");
  return typeof candidate === "number" ? candidate : 0;
};

const callRawMethod = (raw: unknown, method: "ping" | "terminate"): boolean => {
  if (!raw || typeof raw !== "object") return false;
  const candidate = Reflect.get(raw, method);
  if (typeof candidate !== "function") return false;
  try {
    candidate.call(raw);
    return true;
  } catch {
    return false;
  }
};

const onRawEvent = (raw: unknown, event: "pong", listener: () => void): (() => void) | null => {
  if (!raw || typeof raw !== "object") return null;
  const on = Reflect.get(raw, "on");
  const off = Reflect.get(raw, "off");
  if (typeof on !== "function" || typeof off !== "function") return null;
  on.call(raw, event, listener);
  return () => {
    try {
      off.call(raw, event, listener);
    } catch {
      /* socket already torn down */
    }
  };
};

const safeSendRaw = (
  ws: BroadcastSocket,
  payload: string | ArrayBuffer | Uint8Array<ArrayBuffer>,
): void => {
  if (ws.readyState !== WS_READY_STATE_OPEN) return;
  if (getRawBufferedAmount(ws.raw) > WS_BACKPRESSURE_THRESHOLD_BYTES) {
    ws.close(WS_CLOSE_BACKPRESSURE, "backpressure");
    return;
  }
  try {
    ws.send(payload);
  } catch {
    /* socket closed between readyState check and send */
  }
};

const safeSend = (ws: BroadcastSocket, payload: ServerToClientMessage): void => {
  safeSendRaw(ws, JSON.stringify(payload));
};

export const createServer = async (options: ServerOptions = {}): Promise<RunningServer> => {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  if (!isLoopbackHost(host)) {
    throw new ServerErrorException(serverError.nonLoopbackHost(host));
  }

  const staticRoot =
    typeof options.staticRoot === "string" ? path.resolve(options.staticRoot) : null;

  loadOrCreateAgentToken();

  const registry = new SessionRegistry();
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app });

  const api = new Hono();
  api.use("*", loopbackMiddleware);
  api.get("/health", (context) => context.json({ ok: true, sessions: registry.size() }));
  api.notFound((context) => context.json({ error: "not_found" }, HTTP_STATUS_NOT_FOUND));
  app.route("/api", api);

  app.get(
    "/ws",
    upgradeWebSocket((context) => {
      const blocked = enforceLoopback(context);
      if (blocked) {
        return { onOpen: (_event, ws) => ws.close(WS_CLOSE_POLICY_VIOLATION, "forbidden") };
      }

      let session: Session | null = null;
      let drainPollTimer: NodeJS.Timeout | null = null;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let stopHeartbeat: (() => void) | null = null;
      let outputBatcher: OutputBatcher | null = null;

      const stopDrainPoll = () => {
        if (drainPollTimer === null) return;
        clearInterval(drainPollTimer);
        drainPollTimer = null;
      };

      const stopHeartbeatChecks = () => {
        if (heartbeatTimer !== null) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (stopHeartbeat) {
          stopHeartbeat();
          stopHeartbeat = null;
        }
      };

      const rawCwd = context.req.query("cwd");
      let requestedCwd: string | undefined;
      if (rawCwd) {
        try {
          const stat = fs.statSync(rawCwd);
          if (stat.isDirectory()) requestedCwd = rawCwd;
        } catch {
          /* invalid or inaccessible path; fall back to default cwd */
        }
      }

      const rawMode = context.req.query("mode");
      const sessionMode: "human" | "agent" = rawMode === "agent" ? "agent" : "human";

      return {
        onOpen(_event, ws) {
          if (sessionMode === "agent") {
            const rawToken = context.req.query("token");
            if (!rawToken || !validateAgentToken(rawToken)) {
              ws.close(1008, "invalid agent token");
              return;
            }
          }
          const maxSessions = options.maxConcurrentSessions ?? MAX_CONCURRENT_SESSIONS;
          if (registry.size() >= maxSessions) {
            ws.close(WS_CLOSE_CAPACITY_REACHED, "session capacity reached");
            return;
          }
          const integrationEnv =
            sessionMode === "agent" ? { [SHELL_INTEGRATION_ENV_VAR]: "1" } : undefined;
          const newSession = new Session({
            cwd: requestedCwd,
            mode: sessionMode,
            env: integrationEnv,
          });
          session = newSession;
          registry.register(newSession);

          // Heartbeat. Without this, half-open sockets (laptop sleep, network
          // dropout) never surface as a `close` event and the daemon keeps
          // streaming PTY output into the void. We only enable it if the raw
          // socket exposes `on("pong")` — otherwise the timer would tick with
          // no pongs ever observed and kill healthy connections after the
          // first idle window.
          let lastPongAt = Date.now();
          let pendingPingAt = 0;
          stopHeartbeat = onRawEvent(ws.raw, "pong", () => {
            lastPongAt = Date.now();
            pendingPingAt = 0;
          });
          if (stopHeartbeat) {
            heartbeatTimer = setInterval(() => {
              if (ws.readyState !== WS_READY_STATE_OPEN) return;
              const now = Date.now();
              const idleMs = now - lastPongAt;
              const heartbeatAction = getHeartbeatAction(now, lastPongAt, pendingPingAt);
              if (heartbeatAction === "wait") return;
              if (heartbeatAction === "grace-ping") {
                pendingPingAt = now;
                callRawMethod(ws.raw, "ping");
                return;
              }
              if (heartbeatAction === "terminate") {
                console.warn(
                  `ws heartbeat timeout: no pong for ${idleMs}ms (grace ${now - pendingPingAt}ms, pid ${newSession.pid}); terminating`,
                );
                stopHeartbeatChecks();
                if (!callRawMethod(ws.raw, "terminate")) ws.close();
                return;
              }
              callRawMethod(ws.raw, "ping");
            }, WS_HEARTBEAT_INTERVAL_MS);
            heartbeatTimer.unref?.();
          }

          // Outbound flow control. When the WS buffer climbs past the high
          // water mark we pause the PTY (OS pipe back-pressure stops the
          // child process producing more output) and start polling for the
          // buffer to drain back below the low water mark.  This way bursty
          // output (`cat`, build logs, npm install) doesn't kill the
          // connection — only a genuinely wedged receiver eventually trips
          // the WS_BACKPRESSURE_THRESHOLD_BYTES emergency in safeSend.
          const ensureDrainPoll = () => {
            if (drainPollTimer !== null) return;
            drainPollTimer = setInterval(() => {
              if (!newSession.isPaused) {
                stopDrainPoll();
                return;
              }
              if (getRawBufferedAmount(ws.raw) <= WS_OUTBOUND_RESUME_LOW_WATER_BYTES) {
                newSession.resume();
                stopDrainPoll();
              }
            }, WS_OUTBOUND_DRAIN_POLL_MS);
            drainPollTimer.unref?.();
          };

          // Wire listeners BEFORE the first safeSend so any synchronous emit
          // from Session (current or future) reaches the client. Today
          // node-pty's data/exit are async, but this guards against drift.
          outputBatcher = new OutputBatcher((output) => {
            // Fast-path: skip copy when already a full-buffer view
            const raw = output.buffer as ArrayBuffer;
            const byteOffset = output.byteOffset;
            const byteLength = output.byteLength;
            if (byteOffset === 0 && byteLength === raw.byteLength) {
              safeSendRaw(ws, raw);
            } else {
              safeSendRaw(ws, raw.slice(byteOffset, byteOffset + byteLength));
            }
            if (
              !newSession.isPaused &&
              getRawBufferedAmount(ws.raw) >= WS_OUTBOUND_PAUSE_HIGH_WATER_BYTES
            ) {
              newSession.pause();
              ensureDrainPoll();
            }
          });
          const onOutput = (data: string) => outputBatcher?.push(data);
          const onTitle = (title: string) => safeSend(ws, { type: "title", title });
          const onCwd = (cwd: string) => safeSend(ws, { type: "cwd", cwd });
          const onExit = (code: number | null) => {
            outputBatcher?.flush();
            outputBatcher?.dispose();
            outputBatcher = null;
            stopDrainPoll();
            stopHeartbeatChecks();
            safeSend(ws, { type: "exit", code });
            ws.close();
          };
          newSession.on("output", onOutput);
          // Agent-mode gets ANSI-stripped text alongside raw binary output.
          if (sessionMode === "agent") {
            const onAgentOutput = (data: string) => {
              const text = stripAnsi(data);
              if (text) safeSend(ws, { type: "agent-output", text });
            };
            newSession.on("output", onAgentOutput);
          }
          const onCommandBoundary = (boundary: { phase: string; exitCode?: number }) => {
            safeSend(ws, {
              type: "command-boundary",
              phase: boundary.phase as
                | "prompt-start"
                | "command-start"
                | "output-start"
                | "command-end",
              ...(boundary.exitCode !== undefined ? { exitCode: boundary.exitCode } : {}),
            });
          };
          newSession.on("commandBoundary", onCommandBoundary);
          newSession.on("title", onTitle);
          newSession.on("cwd", onCwd);
          newSession.on("exit", onExit);

          safeSend(ws, {
            type: "session",
            shell: newSession.shell,
            shellName: newSession.shellBaseName,
            pid: newSession.pid,
            cwd: newSession.cwd,
          });
        },
        onMessage(event, ws) {
          if (!session) return;
          let rawPayload: unknown;
          try {
            const raw = typeof event.data === "string" ? event.data : event.data.toString();
            rawPayload = JSON.parse(raw);
          } catch {
            return;
          }
          const parsed = clientToServerMessageSchema.safeParse(rawPayload);
          if (!parsed.success) return;
          if (parsed.data.type === "input") {
            session.write(parsed.data.data);
          } else if (parsed.data.type === "resize") {
            session.resize(parsed.data.cols, parsed.data.rows);
          } else if (parsed.data.type === "flow-pause") {
            session.pause();
          } else if (parsed.data.type === "flow-resume") {
            session.resume();
          } else if (parsed.data.type === "rpc") {
            handleRpcRequest(
              {
                registry,
                allowDestructiveCommands: options.allowDestructiveCommands ?? false,
                sendResponse: (rpcId: string, result?: unknown, error?: string) => {
                  safeSend(ws, { type: "rpc-response", id: rpcId, result, error });
                },
              },
              { id: parsed.data.id, method: parsed.data.method, params: parsed.data.params },
            );
          }
        },
        onClose(event) {
          outputBatcher?.dispose();
          outputBatcher = null;
          stopDrainPoll();
          stopHeartbeatChecks();
          // Most "the terminal randomly died" reports are actually the WS
          // closing for a reason we never surfaced; logging code+reason+
          // wasClean here makes the next incident a 1-line lookup in
          // ~/.localterm/server.log.
          const pidLabel = session ? ` pid ${session.pid}` : "";
          console.info(
            `ws closed${pidLabel}: code=${event.code} reason=${JSON.stringify(event.reason)} wasClean=${event.wasClean}`,
          );
          if (!session) return;
          registry.unregister(session);
          session.dispose();
          session = null;
        },
        onError(event) {
          outputBatcher?.dispose();
          outputBatcher = null;
          stopDrainPoll();
          stopHeartbeatChecks();
          const errorValue =
            event && typeof event === "object" ? (Reflect.get(event, "error") ?? event) : event;
          const message = errorValue instanceof Error ? errorValue.message : String(errorValue);
          const pidLabel = session ? ` pid ${session.pid}` : "";
          console.error(`ws error${pidLabel}: ${message}`);
          if (!session) return;
          registry.unregister(session);
          session.dispose();
          session = null;
        },
      };
    }),
  );

  if (staticRoot) {
    app.use("*", loopbackMiddleware);
    app.get("*", (context) => {
      const requestPath = context.req.path;
      if (requestPath.startsWith("/api/") || requestPath.startsWith("/ws")) {
        return context.json({ error: "not_found" }, HTTP_STATUS_NOT_FOUND);
      }
      const asset = resolveStaticAsset(staticRoot, requestPath);
      if (!asset) return context.text("not found", HTTP_STATUS_NOT_FOUND);
      const shouldRevalidate = REVALIDATED_STATIC_PATHS.has(requestPath);
      return new Response(new Uint8Array(asset.body), {
        status: asset.status,
        headers: {
          "content-type": asset.contentType,
          ...(shouldRevalidate ? { "cache-control": "no-cache" } : {}),
        },
      });
    });
  } else {
    app.use("*", loopbackMiddleware);
    app.get("*", (context) => {
      const requestPath = context.req.path;
      if (requestPath.startsWith("/api/") || requestPath.startsWith("/ws")) {
        return context.json({ error: "not_found" }, HTTP_STATUS_NOT_FOUND);
      }
      return context.html(DEV_MODE_REDIRECT_HTML);
    });
  }

  let httpServer: ServerType | null = null;
  let actualPort = port;
  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      reject(new ServerErrorException(serverError.listenFailed(host, port, error)));
    };
    const node = serve(
      {
        fetch: app.fetch,
        hostname: host,
        port,
      },
      () => {
        const address = node.address();
        if (address && typeof address === "object") actualPort = address.port;
        node.removeListener("error", handleError);
        resolve();
      },
    );
    node.once("error", handleError);
    httpServer = node;
  });
  if (!httpServer) {
    throw new ServerErrorException(
      serverError.listenFailed(
        host,
        port,
        new Error("hono serve() resolved without binding an http server"),
      ),
    );
  }
  injectWebSocket(httpServer);

  const stop = async () => {
    registry.disposeAll();
    // Forcibly tear down every WS first. node-pty + ws upgraded sockets
    // aren't tracked in http.Server's keep-alive set, so target.close() would
    // otherwise wait forever for them and the CLI's force-exit fallback would
    // fire on every shutdown.
    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch {
        /* socket already torn down */
      }
    }
    try {
      wss.close();
    } catch {
      /* idempotent close — wss may already be closed */
    }
    if (!httpServer) return;
    const target = httpServer;
    const closeAllConnections = Reflect.get(target, "closeAllConnections");
    if (typeof closeAllConnections === "function") {
      closeAllConnections.call(target);
    }
    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const grace = setTimeout(settle, SERVER_STOP_GRACE_MS);
      grace.unref?.();
      target.close(() => {
        clearTimeout(grace);
        settle();
      });
    });
  };

  return { port: actualPort, host, registry, stop };
};

export type { Session } from "../session/session.js";
export type { SessionRegistry } from "../session/session-registry.js";
export type * from "../types.js";
export { DEFAULT_HOST, DEFAULT_PORT, WS_CLOSE_BACKPRESSURE } from "../constants.js";
export { isLoopbackHost } from "./security.js";
export { healthSchema } from "../schemas.js";
export {
  ServerErrorException,
  formatServerError,
  isServerErrorException,
  serverError,
} from "../errors.js";
export type { ServerError, ServerErrorCode, ServerErrorKind } from "../errors.js";
