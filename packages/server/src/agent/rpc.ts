import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AGENT_COMMAND_DENYLIST } from "../constants.js";
import { stripAnsi } from "../parser/strip-ansi.js";
import { type CommandBoundary } from "../parser/parse-osc133-from-chunk.js";
import { type SpawnPtyInput } from "../types.js";
import { Session } from "../session/session.js";
import { SessionRegistry } from "../session/session-registry.js";

// ─── RPC parameter schemas ───────────────────────────────────────────────────

const SpawnSessionParamsSchema = z
  .object({
    cwd: z.string().optional(),
    shell: z.string().optional(),
  })
  .strict();

const WriteInputParamsSchema = z
  .object({
    sessionId: z.string().min(1),
    data: z.string(),
  })
  .strict();

const ReadOutputParamsSchema = z
  .object({
    sessionId: z.string().min(1),
    sinceOffset: z.number().optional(),
  })
  .strict();

const WaitForBoundaryParamsSchema = z
  .object({
    sessionId: z.string().min(1),
    timeoutMs: z.number().optional(),
  })
  .strict();

const ExecParamsSchema = z
  .object({
    sessionId: z.string().min(1),
    command: z.string().min(1),
    timeoutMs: z.number().optional(),
  })
  .strict();

// ─── Why WS-RPC instead of HTTP ─────────────────────────────────────────────
// WebSocket is already the single transport for terminal I/O.  Adding a second
// transport (HTTP endpoints) would require port coordination, CORS config for
// agent clients, and a separate auth flow.  By extending the existing WS with
// a lightweight RPC framing we share the same connection lifecycle, auth, and
// backpressure — the agent opens one WS, authenticates once, and gets both
// the terminal output stream AND the control surface through the same pipe.

interface ManagedSession {
  id: string;
  session: Session;
  outputBuffer: string[];
  outputOffset: number;
  lastBoundary: CommandBoundary | null;
}

const isCommandDenied = (command: string): string | null => {
  for (const pattern of AGENT_COMMAND_DENYLIST) {
    if (command.includes(pattern)) return pattern;
  }
  return null;
};

export interface RpcContext {
  registry: SessionRegistry;
  allowDestructiveCommands: boolean;
  sendResponse: (id: string, result?: unknown, error?: string) => void;
}

export interface RpcRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export const handleRpcRequest = (ctx: RpcContext, request: RpcRequest): void => {
  const { id, method, params } = request;
  try {
    switch (method) {
      case "spawn_session":
        return handleSpawnSession(ctx, id, params ?? {});
      case "list_sessions":
        return handleListSessions(ctx, id);
      case "write_input":
        return handleWriteInput(ctx, id, params ?? {});
      case "read_output":
        return handleReadOutput(ctx, id, params ?? {});
      case "wait_for_boundary":
        return handleWaitForBoundary(ctx, id, params ?? {});
      case "exec":
        return handleExec(ctx, id, params ?? {});
      default:
        ctx.sendResponse(id, undefined, `unknown method: ${method}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.sendResponse(id, undefined, `internal error: ${message}`);
  }
};

const handleSpawnSession = (ctx: RpcContext, id: string, params: Record<string, unknown>): void => {
  const { cwd, shell } = SpawnSessionParamsSchema.parse(params);
  const sessionId = randomUUID();

  const input: SpawnPtyInput = {
    cwd,
    shell,
    mode: "agent",
    env: { LOCALTERM_SHELL_INTEGRATION: "1" },
  };

  const session = new Session(input);
  ctx.registry.register(session);

  const managed: ManagedSession = {
    id: sessionId,
    session,
    outputBuffer: [],
    outputOffset: 0,
    lastBoundary: null,
  };

  activeSessions.set(sessionId, managed);

  session.on("output", (data: string) => {
    const text = stripAnsi(data);
    if (text) managed.outputBuffer.push(text);
  });

  session.on("commandBoundary", (boundary: CommandBoundary) => {
    managed.lastBoundary = boundary;
  });

  session.on("exit", () => {
    ctx.registry.unregister(session);
    activeSessions.delete(sessionId);
  });

  ctx.sendResponse(id, {
    sessionId,
    shell: session.shell,
    pid: session.pid,
    cwd: session.cwd,
  });
};

const handleListSessions = (ctx: RpcContext, id: string): void => {
  const sessions = Array.from(activeSessions.values()).map((m) => ({
    id: m.id,
    cwd: m.session.cwd,
    pid: m.session.pid,
    mode: "agent" as const,
    running: !m.session.isExited,
  }));
  ctx.sendResponse(id, { sessions });
};

const handleWriteInput = (ctx: RpcContext, id: string, params: Record<string, unknown>): void => {
  const { sessionId, data } = WriteInputParamsSchema.parse(params);
  const managed = activeSessions.get(sessionId);
  if (!managed) {
    ctx.sendResponse(id, undefined, `session not found: ${sessionId}`);
    return;
  }
  if (managed.session.isExited) {
    ctx.sendResponse(id, undefined, "session has exited");
    return;
  }
  managed.session.write(data);
  ctx.sendResponse(id, { ok: true });
};

const handleReadOutput = (ctx: RpcContext, id: string, params: Record<string, unknown>): void => {
  const { sessionId, sinceOffset } = ReadOutputParamsSchema.parse(params);
  const managed = activeSessions.get(sessionId);
  if (!managed) {
    ctx.sendResponse(id, undefined, `session not found: ${sessionId}`);
    return;
  }

  const offset = typeof sinceOffset === "number" ? sinceOffset : managed.outputOffset;
  const buffer = managed.outputBuffer;

  let charCount = 0;
  let startIndex = -1;
  for (let i = 0; i < buffer.length; i++) {
    const entryLen = buffer[i].length;
    if (charCount + entryLen > offset && startIndex === -1) startIndex = i;
    charCount += entryLen;
  }

  if (startIndex === -1) {
    ctx.sendResponse(id, { text: "", offset: charCount });
    return;
  }

  const text = buffer.slice(startIndex).join("");
  const newOffset = charCount;
  managed.outputOffset = newOffset;

  // Trim consumed entries to prevent unbounded memory growth in long sessions.
  managed.outputBuffer.splice(0, startIndex);

  ctx.sendResponse(id, { text, offset: newOffset });
};

const handleWaitForBoundary = (
  ctx: RpcContext,
  id: string,
  params: Record<string, unknown>,
): void => {
  const { sessionId, timeoutMs } = WaitForBoundaryParamsSchema.parse(params);
  const managed = activeSessions.get(sessionId);
  if (!managed) {
    ctx.sendResponse(id, undefined, `session not found: ${sessionId}`);
    return;
  }

  const timeout = typeof timeoutMs === "number" ? timeoutMs : 30000;

  if (managed.lastBoundary) {
    const boundary = managed.lastBoundary;
    managed.lastBoundary = null;
    ctx.sendResponse(id, boundary);
    return;
  }

  const handler = (boundary: CommandBoundary) => {
    managed.session.off("commandBoundary", handler);
    clearTimeout(timer);
    ctx.sendResponse(id, boundary);
  };

  const timer = setTimeout(() => {
    managed.session.off("commandBoundary", handler);
    ctx.sendResponse(id, undefined, "timeout");
  }, timeout);
  timer.unref();

  managed.session.on("commandBoundary", handler);
};

const handleExec = (ctx: RpcContext, id: string, params: Record<string, unknown>): void => {
  const { sessionId, command, timeoutMs } = ExecParamsSchema.parse(params);
  const managed = activeSessions.get(sessionId);
  if (!managed) {
    ctx.sendResponse(id, undefined, `session not found: ${sessionId}`);
    return;
  }

  if (!command || typeof command !== "string") {
    ctx.sendResponse(id, undefined, "command must be a non-empty string");
    return;
  }

  if (!ctx.allowDestructiveCommands) {
    const denied = isCommandDenied(command);
    if (denied) {
      ctx.sendResponse(
        id,
        undefined,
        `command denied by allowlist (matched pattern: "${denied}"). pass --yolo to localterm start to disable this check.`,
      );
      return;
    }
  }

  if (managed.session.isExited) {
    ctx.sendResponse(id, undefined, "session has exited");
    return;
  }

  const timeout = typeof timeoutMs === "number" ? timeoutMs : 60000;

  managed.session.write(command + "\n");

  const handler = (boundary: CommandBoundary) => {
    if (boundary.phase !== "command-end") return;
    managed.session.off("commandBoundary", handler);
    clearTimeout(timer);

    const text = managed.outputBuffer.join("");
    managed.outputBuffer = [];

    ctx.sendResponse(id, {
      stdoutText: text,
      exitCode: boundary.exitCode ?? 0,
    });
  };

  const timer = setTimeout(() => {
    managed.session.off("commandBoundary", handler);

    const text = managed.outputBuffer.join("");
    managed.outputBuffer = [];

    ctx.sendResponse(id, {
      stdoutText: text,
      exitCode: null,
      partial: true,
    });
  }, timeout);
  timer.unref();

  managed.session.on("commandBoundary", handler);
};

/**
 * Map of session ID → ManagedSession for all sessions created via RPC.
 * These are separate from the human-connection sessions managed by the registry.
 */
const activeSessions = new Map<string, ManagedSession>();
