import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "mock-session-uuid"),
}));

// Create a minimal EventEmitter-alike so the mock works without node:events
const { MockSession, sessionInstances } = vi.hoisted(() => {
  const instances: Array<{
    shell: string;
    cwd: string;
    pid: number;
    isExited: boolean;
    mode: string;
    write: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: unknown[]) => boolean;
    once: ReturnType<typeof vi.fn>;
    removeAllListeners: ReturnType<typeof vi.fn>;
    eventHandlers: Record<string, Array<(...args: unknown[]) => void>>;
  }> = [];

  class MSession {
    shell = "/bin/sh";
    cwd = "/tmp";
    pid = 12345;
    isExited = false;
    mode = "agent";
    shellBaseName = "sh";
    write = vi.fn();
    dispose = vi.fn();
    kill = vi.fn();
    on = vi.fn();
    off = vi.fn();
    once = vi.fn();
    removeAllListeners = vi.fn();
    eventHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};

    constructor(input?: unknown) {
      const opts = input as Record<string, unknown> | undefined;
      if (opts?.shell) this.shell = opts.shell as string;
      if (opts?.cwd) this.cwd = opts.cwd as string;
      this.mode = (opts?.mode as string) ?? "human";
      // Implement on/off/emit for real event handling in tests
      this.eventHandlers = {};
      this.on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
        this.eventHandlers[event]!.push(handler);
        return this;
      });
      this.off = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const handlers = this.eventHandlers[event];
        if (handlers) {
          const idx = handlers.indexOf(handler);
          if (idx !== -1) handlers.splice(idx, 1);
        }
        return this;
      });
      this.emit = (event: string, ...args: unknown[]): boolean => {
        const handlers = this.eventHandlers[event];
        if (handlers) handlers.forEach((h) => h(...args));
        return true;
      };
      instances.push(this);
    }

    emit(_event: string, ..._args: unknown[]): boolean {
      return true;
    }
  }

  return { MockSession: MSession, sessionInstances: instances };
});

vi.mock("../src/session/session.js", () => ({
  Session: MockSession,
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { type RpcContext, type RpcRequest, handleRpcRequest } from "../src/agent/rpc.js";
import { SessionRegistry } from "../src/session/session-registry.js";

describe("isCommandDenied (through handleExec)", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;

  beforeEach(() => {
    responses = [];
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
  });

  afterEach(() => {
    sessionInstances.length = 0;
  });

  const createExecRequest = (command: string, overrides: Partial<RpcRequest> = {}): RpcRequest => ({
    id: "exec-1",
    method: "exec",
    params: { sessionId: "mock-session-uuid", command },
    ...overrides,
  });

  it("rejects rm command via denylist", () => {
    // Register a session first via spawn_session
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });
    const session = sessionInstances[0];
    expect(session).toBeDefined();

    handleRpcRequest(ctx, createExecRequest("rm -rf /"));
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.error).toContain("command denied by allowlist");
    expect(lastResponse?.error).toContain("rm");
  });

  it("rejects dd command", () => {
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });

    handleRpcRequest(ctx, createExecRequest("dd if=/dev/zero of=/tmp/out"));
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.error).toContain("command denied by allowlist");
    expect(lastResponse?.error).toContain("dd");
  });

  it("rejects mkfs command", () => {
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });

    handleRpcRequest(ctx, createExecRequest("mkfs.ext4 /dev/sda1"));
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.error).toContain("command denied by allowlist");
    expect(lastResponse?.error).toContain("mkfs");
  });

  it("rejects commands writing to block devices", () => {
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });

    handleRpcRequest(ctx, createExecRequest("echo data > /dev/sda"));
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.error).toContain("command denied by allowlist");
    expect(lastResponse?.error).toContain("> /dev/");
  });

  it("rejects fork bomb", () => {
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });

    handleRpcRequest(ctx, createExecRequest(":(){ :|:& };:"));
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.error).toContain("command denied by allowlist");
  });

  it("allows non-denied commands when allowDestructiveCommands is false", () => {
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });

    // Setup session to emit command-end on write
    const session = sessionInstances[0];
    session.write = vi.fn(() => {
      // Simulate session writing command then emitting boundary
      setTimeout(() => session.emit("commandBoundary", { phase: "command-end", exitCode: 0 }), 10);
    });
    vi.useFakeTimers();
    handleRpcRequest(ctx, createExecRequest("ls -la"));
    vi.advanceTimersToNextTimer();
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.result).toBeDefined();
    expect(lastResponse!.result).toHaveProperty("stdoutText", "");
    expect(lastResponse!.result).toHaveProperty("exitCode", 0);
    vi.useRealTimers();
  });

  it("allows all commands when allowDestructiveCommands is true", () => {
    ctx.allowDestructiveCommands = true;
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });

    const session = sessionInstances[0];
    session.write = vi.fn(() => {
      setTimeout(() => session.emit("commandBoundary", { phase: "command-end", exitCode: 0 }), 10);
    });
    vi.useFakeTimers();
    handleRpcRequest(ctx, createExecRequest("rm -rf /"));
    vi.advanceTimersToNextTimer();
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.error).toBeUndefined();
    expect(lastResponse?.result).toBeDefined();
    vi.useRealTimers();
  });
});

describe("handleSpawnSession", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;

  beforeEach(() => {
    responses = [];
    sessionInstances.length = 0;
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
  });

  it("creates a session and registers it", () => {
    handleRpcRequest(ctx, { id: "req-1", method: "spawn_session", params: {} });

    expect(responses).toHaveLength(1);
    expect(responses[0]?.id).toBe("req-1");
    expect(responses[0]?.error).toBeUndefined();
    const result = responses[0]?.result as Record<string, unknown>;
    expect(result?.sessionId).toBe("mock-session-uuid");
    expect(result?.shell).toBe("/bin/sh");
    expect(result?.pid).toBe(12345);
    expect(ctx.registry.size()).toBe(1);
  });

  it("creates session with custom cwd and shell", () => {
    handleRpcRequest(ctx, {
      id: "req-2",
      method: "spawn_session",
      params: { cwd: "/workspace", shell: "/bin/zsh" },
    });

    expect(responses).toHaveLength(1);
    const result = responses[0]?.result as Record<string, unknown>;
    expect(result?.shell).toBe("/bin/zsh");
    expect(result?.cwd).toBe("/workspace");
  });

  it("handles extra params gracefully by using strict schema", () => {
    handleRpcRequest(ctx, {
      id: "req-3",
      method: "spawn_session",
      params: { cwd: "/tmp", extraField: "should-be-rejected" },
    });

    // Strict schema should reject extra params
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse?.error).toBeDefined();
    expect(ctx.registry.size()).toBe(0);
  });
});

describe("handleListSessions", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;
  let handleRpcRequest: (ctx: RpcContext, request: RpcRequest) => void;

  beforeEach(async () => {
    // Reset modules so activeSessions in agent-rpc.ts starts empty
    vi.resetModules();
    const mod = await import("../src/agent/rpc.js");
    handleRpcRequest = mod.handleRpcRequest;
    responses = [];
    sessionInstances.length = 0;
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
  });

  it("returns empty list when no sessions exist", () => {
    handleRpcRequest(ctx, { id: "list-1", method: "list_sessions" });

    expect(responses).toHaveLength(1);
    expect(responses[0]!.result).toHaveProperty("sessions", []);
  });

  it("returns list of created sessions", () => {
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });
    responses = [];
    handleRpcRequest(ctx, { id: "list-2", method: "list_sessions" });

    expect(responses[0]!.result).toHaveProperty("sessions", [
      expect.objectContaining({ id: "mock-session-uuid", running: true }),
    ]);
  });

  it("shows session as not running after exit", () => {
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });
    const session = sessionInstances[0];
    session.isExited = true;
    responses = [];

    handleRpcRequest(ctx, { id: "list-1", method: "list_sessions" });
    expect(responses[0]!.result).toHaveProperty("sessions", [
      expect.objectContaining({ running: false }),
    ]);
  });
});

describe("handleWriteInput", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;

  beforeEach(() => {
    responses = [];
    sessionInstances.length = 0;
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });
    responses = []; // discard spawn response so tests always start fresh
  });

  it("writes data to an existing session", () => {
    const session = sessionInstances[0];

    handleRpcRequest(ctx, {
      id: "write-1",
      method: "write_input",
      params: { sessionId: "mock-session-uuid", data: "echo hello\n" },
    });

    expect(session.write).toHaveBeenCalledWith("echo hello\n");
    expect(responses[0]!.result).toHaveProperty("ok", true);
  });

  it("returns error for non-existent session", () => {
    handleRpcRequest(ctx, {
      id: "write-2",
      method: "write_input",
      params: { sessionId: "non-existent", data: "test" },
    });

    expect(responses[0]?.error).toContain("session not found");
  });

  it("returns error when session has exited", () => {
    const session = sessionInstances[0];
    session.isExited = true;
    responses = [];

    handleRpcRequest(ctx, {
      id: "write-3",
      method: "write_input",
      params: { sessionId: "mock-session-uuid", data: "test" },
    });

    expect(responses[0]?.error).toContain("session has exited");
    expect(session.write).not.toHaveBeenCalled();
  });

  it("rejects empty sessionId", () => {
    handleRpcRequest(ctx, {
      id: "write-4",
      method: "write_input",
      params: { sessionId: "", data: "test" },
    });

    expect(responses[0]?.error).toBeDefined();
  });
});

describe("handleReadOutput", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;

  beforeEach(() => {
    responses = [];
    sessionInstances.length = 0;
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });
    responses = [];
  });

  it("returns empty text when no output has been produced", () => {
    handleRpcRequest(ctx, {
      id: "read-1",
      method: "read_output",
      params: { sessionId: "mock-session-uuid" },
    });

    expect(responses[0]!.result).toHaveProperty("text", "");
    expect(responses[0]!.result).toHaveProperty("offset", 0);
  });

  it("returns error for non-existent session", () => {
    handleRpcRequest(ctx, {
      id: "read-2",
      method: "read_output",
      params: { sessionId: "non-existent" },
    });

    expect(responses[0]?.error).toContain("session not found");
  });

  it("returns output text accumulated since last read", () => {
    handleRpcRequest(ctx, {
      id: "read-3",
      method: "read_output",
      params: { sessionId: "mock-session-uuid" },
    });
    expect(responses[0]!.result).toHaveProperty("text", "");
    expect(responses[0]!.result).toHaveProperty("offset", 0);
  });
});

describe("handleWaitForBoundary", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;

  beforeEach(() => {
    responses = [];
    sessionInstances.length = 0;
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });
    responses = [];
  });

  it("returns immediately if a boundary is already available", () => {
    // The session emits commandBoundary → handler pushes to managed.lastBoundary
    const session = sessionInstances[0];
    session.emit("commandBoundary", { phase: "prompt-start" });

    handleRpcRequest(ctx, {
      id: "wait-1",
      method: "wait_for_boundary",
      params: { sessionId: "mock-session-uuid" },
    });

    expect(responses[0]?.result).toEqual({ phase: "prompt-start" });
  });

  it("waits for a boundary event when none is pending", () => {
    vi.useFakeTimers();
    handleRpcRequest(ctx, {
      id: "wait-2",
      method: "wait_for_boundary",
      params: { sessionId: "mock-session-uuid", timeoutMs: 5000 },
    });

    expect(responses).toHaveLength(0); // Not yet resolved

    const session = sessionInstances[0];
    session.emit("commandBoundary", { phase: "command-end", exitCode: 0 });
    expect(responses).toHaveLength(1);
    expect(responses[0]?.result).toEqual({ phase: "command-end", exitCode: 0 });
    vi.useRealTimers();
  });

  it("times out if no boundary arrives within timeout", () => {
    vi.useFakeTimers();
    handleRpcRequest(ctx, {
      id: "wait-3",
      method: "wait_for_boundary",
      params: { sessionId: "mock-session-uuid", timeoutMs: 100 },
    });

    expect(responses).toHaveLength(0); // Not yet resolved
    vi.advanceTimersByTime(100);
    expect(responses).toHaveLength(1);
    expect(responses[0]?.error).toBe("timeout");
    vi.useRealTimers();
  });

  it("returns error for non-existent session", () => {
    handleRpcRequest(ctx, {
      id: "wait-4",
      method: "wait_for_boundary",
      params: { sessionId: "non-existent" },
    });

    expect(responses[0]?.error).toContain("session not found");
  });
});

describe("handleExec", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;

  beforeEach(() => {
    responses = [];
    sessionInstances.length = 0;
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
    handleRpcRequest(ctx, { id: "spawn-1", method: "spawn_session", params: {} });
    responses = [];
  });

  it("reports error for non-existent session", () => {
    handleRpcRequest(ctx, {
      id: "exec-1",
      method: "exec",
      params: { sessionId: "does-not-exist", command: "ls" },
    });

    expect(responses[0]?.error).toContain("session not found");
  });

  it("reports error when session has exited", () => {
    const session = sessionInstances[0];
    session.isExited = true;

    handleRpcRequest(ctx, {
      id: "exec-2",
      method: "exec",
      params: { sessionId: "mock-session-uuid", command: "ls" },
    });

    expect(responses[0]?.error).toContain("session has exited");
  });

  it("reports error for denied command", () => {
    handleRpcRequest(ctx, {
      id: "exec-3",
      method: "exec",
      params: { sessionId: "mock-session-uuid", command: "rm -rf /" },
    });

    expect(responses[0]?.error).toContain("command denied by allowlist");
  });

  it("writes command and waits for command-end boundary", () => {
    const session = sessionInstances[0];

    // Mock write to trigger command-end
    vi.useFakeTimers();
    session.write = vi.fn(() => {
      setTimeout(() => session.emit("commandBoundary", { phase: "command-end", exitCode: 0 }), 50);
    });

    handleRpcRequest(ctx, {
      id: "exec-4",
      method: "exec",
      params: { sessionId: "mock-session-uuid", command: "ls -la", timeoutMs: 5000 },
    });

    expect(session.write).toHaveBeenCalledWith("ls -la\n");
    expect(responses).toHaveLength(0); // Not yet resolved

    vi.advanceTimersByTime(50);
    expect(responses).toHaveLength(1);
    expect(responses[0]!.result).toHaveProperty("stdoutText", "");
    expect(responses[0]!.result).toHaveProperty("exitCode", 0);
    vi.useRealTimers();
  });

  it("returns partial result on timeout before command-end", () => {
    // Don't emit command-end, let timeout fire
    vi.useFakeTimers();

    handleRpcRequest(ctx, {
      id: "exec-5",
      method: "exec",
      params: { sessionId: "mock-session-uuid", command: "sleep 10", timeoutMs: 100 },
    });

    vi.advanceTimersByTime(100);
    expect(responses).toHaveLength(1);
    expect(responses[0]!.result).toHaveProperty("exitCode", null);
    expect(responses[0]!.result).toHaveProperty("partial", true);
    vi.useRealTimers();
  });

  it("ignores non-command-end boundaries and waits for command-end", () => {
    const session = sessionInstances[0];
    vi.useFakeTimers();
    session.write = vi.fn(() => {
      // Emit prompt-start first, then command-end
      setTimeout(() => session.emit("commandBoundary", { phase: "prompt-start" }), 10);
      setTimeout(() => session.emit("commandBoundary", { phase: "command-start" }), 20);
      setTimeout(() => session.emit("commandBoundary", { phase: "output-start" }), 30);
      setTimeout(() => session.emit("commandBoundary", { phase: "command-end", exitCode: 0 }), 40);
    });

    handleRpcRequest(ctx, {
      id: "exec-6",
      method: "exec",
      params: { sessionId: "mock-session-uuid", command: "build", timeoutMs: 5000 },
    });

    vi.advanceTimersByTime(40);
    expect(responses).toHaveLength(1);
    expect(responses[0]!.result).toHaveProperty("exitCode", 0);
    vi.useRealTimers();
  });
});

describe("handleRpcRequest routing", () => {
  let ctx: RpcContext;
  let responses: Array<{ id: string; result?: unknown; error?: string }>;

  beforeEach(() => {
    responses = [];
    sessionInstances.length = 0;
    ctx = {
      registry: new SessionRegistry(),
      allowDestructiveCommands: false,
      sendResponse: (id: string, result?: unknown, error?: string) => {
        responses.push({ id, result, error });
      },
    };
  });

  it("returns error for unknown method", () => {
    handleRpcRequest(ctx, { id: "req-1", method: "unknown_method" });

    expect(responses[0]?.error).toContain("unknown method");
  });

  it("catches internal errors and reports them", () => {
    // Dispatch a spawn_session with invalid params to trigger a Zod error
    handleRpcRequest(ctx, {
      id: "req-2",
      method: "spawn_session",
      params: { invalidParam: true },
    });

    expect(responses[0]?.error).toBeDefined();
  });
});
