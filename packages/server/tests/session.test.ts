/* eslint-disable @typescript-eslint/no-explicit-any — test accesses private onPtyOutput */
import { describe, expect, it } from "vite-plus/test";
import { serverToClientMessageSchema } from "../src/schemas.js";
import { Session } from "../src/session/session.js";

const waitFor = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);

const collectOutput = async (session: Session, timeoutMs = 1500): Promise<string> => {
  return waitFor(
    new Promise<string>((resolve) => {
      let buffer = "";
      let stableTimer: NodeJS.Timeout | null = null;
      const onData = (chunk: string) => {
        buffer += chunk;
        if (stableTimer) clearTimeout(stableTimer);
        stableTimer = setTimeout(() => {
          session.off("output", onData);
          resolve(buffer);
        }, 200);
      };
      session.on("output", onData);
    }),
    timeoutMs,
  );
};

describe("Session", () => {
  it("spawns a shell and emits output for typed input", async () => {
    const session = new Session({ shell: "/bin/sh" });
    try {
      await collectOutput(session);
      session.write("echo SESSION_TEST_TOKEN\n");
      const output = await collectOutput(session);
      expect(output).toContain("SESSION_TEST_TOKEN");
    } finally {
      session.destroy();
    }
  });

  it("exposes shell metadata used by the settings panel (path, basename, pid, cwd)", () => {
    const session = new Session({ shell: "/bin/sh", cwd: "/" });
    try {
      expect(session.shell).toBe("/bin/sh");
      expect(session.shellBaseName).toBe("sh");
      expect(session.cwd).toBe("/");
      expect(Number.isInteger(session.pid)).toBe(true);
      expect(session.pid).toBeGreaterThan(0);
    } finally {
      session.destroy();
    }
  });

  it("Session metadata produces a 'session' WS frame accepted by the public schema", () => {
    // Locks in the contract that index.ts emits on WS open. If anyone changes the
    // Session getters or the schema in a way that breaks this round-trip, this test
    // catches it before the client silently loses the Settings → Shell section.
    const session = new Session({ shell: "/bin/sh", cwd: "/" });
    try {
      const frame = {
        type: "session" as const,
        id: session.id,
        shell: session.shell,
        shellName: session.shellBaseName,
        pid: session.pid,
        cwd: session.cwd,
      };
      const parsed = serverToClientMessageSchema.safeParse(frame);
      expect(parsed.success).toBe(true);
    } finally {
      session.destroy();
    }
  });

  it("emits exit when the shell exits", async () => {
    const session = new Session({ shell: "/bin/sh" });
    const exitPromise = waitFor(
      new Promise<number | null>((resolve) => {
        session.once("exit", (code) => resolve(code));
      }),
      3000,
    );
    session.write("exit 0\n");
    const code = await exitPromise;
    expect(code).toBe(0);
    session.destroy();
  });

  it("ignores writes after exit", async () => {
    const session = new Session({ shell: "/bin/sh" });
    const exitPromise = new Promise<void>((resolve) => session.once("exit", () => resolve()));
    session.kill();
    await waitFor(exitPromise, 3000);
    expect(session.isExited).toBe(true);
    expect(() => session.write("anything")).not.toThrow();
    session.destroy();
  });

  it("kills the underlying PTY child when destroy is called before the shell exits", async () => {
    const session = new Session({ shell: "/bin/sh" });
    await collectOutput(session);
    const childPid = session.pid;
    session.destroy();

    const isProcessAlive = (pid: number): boolean => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };

    await waitFor(
      new Promise<void>((resolve, reject) => {
        const startedAt = Date.now();
        const poll = () => {
          if (!isProcessAlive(childPid)) {
            resolve();
            return;
          }
          if (Date.now() - startedAt > 2000) {
            reject(new Error(`pid ${childPid} still alive 2s after destroy`));
            return;
          }
          setTimeout(poll, 50);
        };
        poll();
      }),
      2500,
    );
  });

  it("clamps resize to current dimensions", () => {
    const session = new Session({ shell: "/bin/sh", cols: 80, rows: 24 });
    try {
      const before = { cols: session.cols, rows: session.rows };
      session.resize(0, 24);
      session.resize(80, 0);
      session.resize(-5, -5);
      expect(session.cols).toBe(before.cols);
      expect(session.rows).toBe(before.rows);
    } finally {
      session.destroy();
    }
  });

  it("emits titles on a dedicated event channel (never spliced into PTY output)", async () => {
    const session = new Session({ shell: "/bin/sh" });
    try {
      const observedTitle = await waitFor(
        new Promise<string>((resolve) => {
          session.once("title", (title) => resolve(title));
        }),
        2000,
      );
      expect(observedTitle.length).toBeGreaterThan(0);

      const escapeChar = String.fromCharCode(0x1b);
      const outputChunks: string[] = [];
      const onData = (chunk: string) => outputChunks.push(chunk);
      session.on("output", onData);
      await new Promise((resolve) => setTimeout(resolve, 700));
      session.off("output", onData);
      const combined = outputChunks.join("");
      expect(combined).not.toContain(`${escapeChar}]2;`);
      expect(combined).not.toContain(`${escapeChar}]0;`);
    } finally {
      session.destroy();
    }
  });

  it("destroy stops emitting any further title polls", async () => {
    const session = new Session({ shell: "/bin/sh" });
    await collectOutput(session);
    session.destroy();
    let postDestroyTitleCount = 0;
    const onTitle = () => {
      postDestroyTitleCount += 1;
    };
    session.on("title", onTitle);
    await new Promise((resolve) => setTimeout(resolve, 800));
    session.off("title", onTitle);
    expect(postDestroyTitleCount).toBe(0);
  });

  it("pause() suppresses output emissions and resume() lets them flow again", async () => {
    const session = new Session({ shell: "/bin/sh" });
    try {
      await collectOutput(session);

      session.pause();
      expect(session.isPaused).toBe(true);

      const chunksWhilePaused: string[] = [];
      const collectWhilePaused = (chunk: string) => chunksWhilePaused.push(chunk);
      session.on("output", collectWhilePaused);
      session.write("printf PAUSED_MARKER_DOES_NOT_LEAK\n");
      // Generous window: even on a slow runner, paused output should never arrive.
      await new Promise((resolve) => setTimeout(resolve, 400));
      session.off("output", collectWhilePaused);
      expect(chunksWhilePaused.join("")).not.toContain("PAUSED_MARKER_DOES_NOT_LEAK");

      session.resume();
      expect(session.isPaused).toBe(false);
      const observed = await collectOutput(session, 3000);
      expect(observed).toContain("PAUSED_MARKER_DOES_NOT_LEAK");
    } finally {
      session.destroy();
    }
  });

  it("pause() and resume() are no-ops after the session has exited", () => {
    const session = new Session({ shell: "/bin/sh" });
    session.destroy();
    expect(session.isExited).toBe(true);
    expect(() => session.pause()).not.toThrow();
    expect(session.isPaused).toBe(false);
    expect(() => session.resume()).not.toThrow();
  });

  describe("park / destroy lifecycle", () => {
    it("park starts a grace timer that destroys the session on expiry", async () => {
      const session = new Session({ shell: "/bin/sh", cols: 80, rows: 24 });
      expect(session.isExited).toBe(false);
      session.park(50); // 50ms grace period
      await new Promise((r) => setTimeout(r, 150));
      expect(session.isExited).toBe(true);
      session.destroy(); // idempotent cleanup
    });

    it("cancelPark prevents the grace timer from destroying the session", async () => {
      const session = new Session({ shell: "/bin/sh", cols: 80, rows: 24 });
      session.park(100); // 100ms grace period
      session.cancelPark();
      await new Promise((r) => setTimeout(r, 200));
      expect(session.isExited).toBe(false);
      session.destroy();
    });

    it("drainTailBuffer returns captured output while parked", async () => {
      const session = new Session({ shell: "/bin/sh", cols: 80, rows: 24 });
      session.park(60_000); // long grace period
      // Simulate output while parked (onPtyOutput appends to tail buffer when parked)
      (session as any).onPtyOutput("hello ");
      (session as any).onPtyOutput("world");
      const buffer = session.drainTailBuffer();
      expect(buffer).toEqual(["hello ", "world"]);
      // Second drain returns empty
      expect(session.drainTailBuffer()).toEqual([]);
      session.destroy();
    });

    it("drainTailBuffer is empty when session was never parked", async () => {
      const session = new Session({ shell: "/bin/sh", cols: 80, rows: 24 });
      expect(session.drainTailBuffer()).toEqual([]);
      session.destroy();
    });

    it("park on an exited session is a no-op", async () => {
      const session = new Session({ shell: "/bin/sh", cols: 80, rows: 24 });
      session.destroy();
      expect(session.isExited).toBe(true);
      // This should not throw
      session.park();
      expect(session.isExited).toBe(true);
    });

    it("destroy clears the tail buffer", async () => {
      const session = new Session({ shell: "/bin/sh", cols: 80, rows: 24 });
      session.park(60_000);
      (session as any).onPtyOutput("data during park");
      session.destroy();
      expect(session.drainTailBuffer()).toEqual([]);
    });
  });
});
