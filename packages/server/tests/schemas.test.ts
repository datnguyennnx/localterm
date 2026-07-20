import { describe, expect, it } from "vite-plus/test";
import { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, MAX_TITLE_LENGTH } from "../src/constants.js";
import { clientToServerMessageSchema, serverToClientMessageSchema } from "../src/schemas.js";

describe("clientToServerMessageSchema", () => {
  it("accepts an input frame", () => {
    const result = clientToServerMessageSchema.safeParse({ type: "input", data: "ls\r" });
    expect(result.success).toBe(true);
  });

  it("accepts a resize frame", () => {
    const result = clientToServerMessageSchema.safeParse({
      type: "resize",
      cols: 80,
      rows: 24,
    });
    expect(result.success).toBe(true);
  });

  it("rejects oversized input", () => {
    const oversized = "a".repeat(MAX_INPUT_BYTES + 1);
    const result = clientToServerMessageSchema.safeParse({ type: "input", data: oversized });
    expect(result.success).toBe(false);
  });

  it("rejects negative dimensions", () => {
    expect(
      clientToServerMessageSchema.safeParse({ type: "resize", cols: 0, rows: 24 }).success,
    ).toBe(false);
    expect(
      clientToServerMessageSchema.safeParse({ type: "resize", cols: 80, rows: -1 }).success,
    ).toBe(false);
  });

  it("rejects unreasonably large dimensions", () => {
    expect(
      clientToServerMessageSchema.safeParse({ type: "resize", cols: 100000, rows: 24 }).success,
    ).toBe(false);
  });

  it("rejects unknown message types", () => {
    expect(
      clientToServerMessageSchema.safeParse({ type: "input", data: "x", extra: "y" }).success,
    ).toBe(false);
    expect(clientToServerMessageSchema.safeParse({ type: "kill" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(clientToServerMessageSchema.safeParse({ type: "input" }).success).toBe(false);
    expect(clientToServerMessageSchema.safeParse({ type: "resize", cols: 80 }).success).toBe(false);
  });

  it("accepts a flow-pause frame", () => {
    const result = clientToServerMessageSchema.safeParse({ type: "flow-pause" });
    expect(result.success).toBe(true);
  });

  it("accepts a flow-resume frame", () => {
    const result = clientToServerMessageSchema.safeParse({ type: "flow-resume" });
    expect(result.success).toBe(true);
  });

  it("rejects flow-pause with extra fields", () => {
    expect(
      clientToServerMessageSchema.safeParse({ type: "flow-pause", extra: "field" }).success,
    ).toBe(false);
  });

  it("rejects flow-resume with extra fields", () => {
    expect(
      clientToServerMessageSchema.safeParse({ type: "flow-resume", extra: "field" }).success,
    ).toBe(false);
  });

  it("accepts an RPC request frame", () => {
    const result = clientToServerMessageSchema.safeParse({
      type: "rpc",
      id: "req-1",
      method: "list_sessions",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an RPC request with params", () => {
    const result = clientToServerMessageSchema.safeParse({
      type: "rpc",
      id: "req-2",
      method: "spawn_session",
      params: { cwd: "/tmp" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an RPC request with unknown method", () => {
    expect(
      clientToServerMessageSchema.safeParse({
        type: "rpc",
        id: "req-3",
        method: "unknown_method",
      }).success,
    ).toBe(false);
  });

  it("rejects an RPC request missing the id field", () => {
    expect(
      clientToServerMessageSchema.safeParse({
        type: "rpc",
        method: "list_sessions",
      }).success,
    ).toBe(false);
  });
});

describe("serverToClientMessageSchema", () => {
  it("accepts every variant", () => {
    expect(serverToClientMessageSchema.safeParse({ type: "output", data: "x" }).success).toBe(true);
    expect(serverToClientMessageSchema.safeParse({ type: "exit", code: 0 }).success).toBe(true);
    expect(serverToClientMessageSchema.safeParse({ type: "exit", code: null }).success).toBe(true);
    expect(serverToClientMessageSchema.safeParse({ type: "title", title: "shell" }).success).toBe(
      true,
    );
  });

  it("rejects the legacy snapshot frame", () => {
    expect(
      serverToClientMessageSchema.safeParse({
        type: "snapshot",
        data: "x",
        cols: 80,
        rows: 24,
        title: "shell",
      }).success,
    ).toBe(false);
  });

  it("rejects title frames missing the title field", () => {
    expect(serverToClientMessageSchema.safeParse({ type: "title" }).success).toBe(false);
  });

  it("rejects oversized output payloads (defense in depth against compromised servers)", () => {
    const oversized = "a".repeat(MAX_OUTPUT_BYTES + 1);
    expect(serverToClientMessageSchema.safeParse({ type: "output", data: oversized }).success).toBe(
      false,
    );
  });

  it("rejects oversized title payloads", () => {
    const oversized = "a".repeat(MAX_TITLE_LENGTH + 1);
    expect(serverToClientMessageSchema.safeParse({ type: "title", title: oversized }).success).toBe(
      false,
    );
  });

  it("accepts a session info frame", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "session",
      id: "test-session-id-123",
      shell: "/bin/zsh",
      shellName: "zsh",
      pid: 12345,
      cwd: "/Users/tester",
    });
    expect(result.success).toBe(true);
  });

  it("rejects session frames missing required fields", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "session",
      shell: "/bin/zsh",
      pid: 12345,
      cwd: "/Users/tester",
    });
    expect(result.success).toBe(false);
  });

  it("rejects session frames with negative PID", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "session",
      shell: "/bin/zsh",
      shellName: "zsh",
      pid: -1,
      cwd: "/Users/tester",
    });
    expect(result.success).toBe(false);
  });

  it("rejects session frames with empty string fields", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "session",
      shell: "",
      shellName: "zsh",
      pid: 1,
      cwd: "/Users/tester",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an agent-output frame", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "agent-output",
      text: "hello from the build step\n✔ done",
    });
    expect(result.success).toBe(true);
  });

  it("rejects agent-output with extra fields", () => {
    expect(
      serverToClientMessageSchema.safeParse({
        type: "agent-output",
        text: "test",
        extra: "field",
      }).success,
    ).toBe(false);
  });

  it("rejects agent-output missing the text field", () => {
    expect(serverToClientMessageSchema.safeParse({ type: "agent-output" }).success).toBe(false);
  });

  it("accepts a command-boundary prompt-start frame", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "command-boundary",
      phase: "prompt-start",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a command-boundary command-end frame with exit code", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "command-boundary",
      phase: "command-end",
      exitCode: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects command-boundary with invalid phase", () => {
    expect(
      serverToClientMessageSchema.safeParse({
        type: "command-boundary",
        phase: "invalid",
      }).success,
    ).toBe(false);
  });

  it("rejects command-boundary with extra fields", () => {
    expect(
      serverToClientMessageSchema.safeParse({
        type: "command-boundary",
        phase: "command-start",
        extra: "field",
      }).success,
    ).toBe(false);
  });

  it("accepts an RPC response frame", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "rpc-response",
      id: "req-1",
      result: { ok: true },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an RPC error response", () => {
    const result = serverToClientMessageSchema.safeParse({
      type: "rpc-response",
      id: "req-2",
      error: "session not found",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an RPC response missing the id field", () => {
    expect(
      serverToClientMessageSchema.safeParse({
        type: "rpc-response",
        result: { ok: true },
      }).success,
    ).toBe(false);
  });
});
