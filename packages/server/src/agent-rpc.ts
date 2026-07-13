import { AGENT_COMMAND_DENYLIST } from "./constants.js";
import { stripAnsi } from "./utils/strip-ansi.js";
import { type CommandBoundary } from "./utils/parse-osc133-from-chunk.js";
import { type SpawnPtyInput } from "./types.js";
import { Session } from "./session.js";
import { SessionRegistry } from "./session-registry.js";

// ─── Why WS-RPC instead of HTTP ─────────────────────────────────────────────
// WebSocket is already the single transport for terminal I/O.  Adding a second
// transport (HTTP endpoints) would require port coordination, CORS config for
// agent clients, and a separate auth flow.  By extending the existing WS with
// a lightweight RPC framing we share the same connection lifecycle, auth, and
// backpressure — the agent opens one WS, authenticates once, and gets both
// the terminal output stream AND the control surface through the same pipe.

export interface ManagedSession {
  id: string;
  session: Session;
  outputBuffer: string[];
  outputOffset: number;
  lastBoundary: CommandBoundary | null;
}

let nextSessionId = 1;

const generateSessionId = (): string => `s${nextSessionId++}`;

const DENYLIST_PATTERNS = AGENT_COMMAND_DENYLIST.map((pattern) => ({
  pattern,
  regex: new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`),
}));

const isCommandDenied = (command: string): string | null => {
  for (const { pattern } of DENYLIST_PATTERNS) {
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

export const handleRpcRequest = (
  ctx: RpcContext,
  request: RpcRequest,
): void => {
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

interface SpawnSessionParams {
  cwd?: string;
  shell?: string;
}

const handleSpawnSession = (
  ctx: RpcContext,
  id: string,
  params: Record<string, unknown>,
): void => {
  const { cwd, shell } = params as unknown as SpawnSessionParams;
  const sessionId = generateSessionId();

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

const handleListSessions = (
  ctx: RpcContext,
  id: string,
): void => {
  const sessions = Array.from(activeSessions.values()).map((m) => ({
    id: m.id,
    cwd: m.session.cwd,
    pid: m.session.pid,
    mode: "agent" as const,
    running: !m.session.isExited,
  }));
  ctx.sendResponse(id, { sessions });
};

interface WriteInputParams {
  sessionId: string;
  data: string;
}

const handleWriteInput = (
  ctx: RpcContext,
  id: string,
  params: Record<string, unknown>,
): void => {
  const { sessionId, data } = params as unknown as WriteInputParams;
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

interface ReadOutputParams {
  sessionId: string;
  sinceOffset?: number;
}

const handleReadOutput = (
  ctx: RpcContext,
  id: string,
  params: Record<string, unknown>,
): void => {
  const { sessionId, sinceOffset } = params as unknown as ReadOutputParams;
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

  ctx.sendResponse(id, { text, offset: newOffset });
};

interface WaitForBoundaryParams {
  sessionId: string;
  timeoutMs?: number;
}

const handleWaitForBoundary = (
  ctx: RpcContext,
  id: string,
  params: Record<string, unknown>,
): void => {
  const { sessionId, timeoutMs } = params as unknown as WaitForBoundaryParams;
  const managed = activeSessions.get(sessionId);
  if (!managed) {
    ctx.sendResponse(id, undefined, `session not found: ${sessionId}`);
    return;
  }

  const timeout = typeof timeoutMs === "number" ? timeoutMs : 30000;

  if (managed.lastBoundary) {
    const boundary = managed.lastBoundary;
    managed.lastBoundary = null;
    ctx.sendResponse(id, boundary as unknown as Record<string, unknown>);
    return;
  }

  const handler = (boundary: CommandBoundary) => {
    managed.session.off("commandBoundary", handler);
    clearTimeout(timer);
    ctx.sendResponse(id, boundary as unknown as Record<string, unknown>);
  };

  const timer = setTimeout(() => {
    managed.session.off("commandBoundary", handler);
    ctx.sendResponse(id, undefined, "timeout");
  }, timeout);
  timer.unref();

  managed.session.on("commandBoundary", handler);
};

interface ExecParams {
  sessionId: string;
  command: string;
  timeoutMs?: number;
}

const handleExec = (
  ctx: RpcContext,
  id: string,
  params: Record<string, unknown>,
): void => {
  const { sessionId, command, timeoutMs } = params as unknown as ExecParams;
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
export const activeSessions = new Map<string, ManagedSession>();
