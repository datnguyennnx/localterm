/* eslint-disable @typescript-eslint/no-explicit-any — test mocks need any */
import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";

// Mock child_process before importing the module under test.
// resolveCwdForPid uses promisify(execFile), so the mocked execFile must call
// its callback argument to resolve the promisified wrapper.
vi.mock("node:child_process", () => {
  const mockExecFile = vi.fn((...args: unknown[]) => {
    // The last argument is the callback added by promisify
    const cb = args[args.length - 1];
    if (typeof cb === "function") {
      (cb as (...args: unknown[]) => void)(null, { stdout: "", stderr: "" });
    }
    return undefined as unknown as import("node:child_process").ChildProcess;
  });
  return { execFile: mockExecFile };
});

vi.mock("node:fs/promises", () => ({
  readlink: vi.fn(),
}));

import { execFile } from "node:child_process";
import { readlink } from "node:fs/promises";
import { resolveCwdForPid } from "../../src/utils/resolve-cwd-for-pid.js";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveCwdForPid", () => {
  describe("platform-independent validation", () => {
    it("returns null for non-positive PID values", async () => {
      expect(await resolveCwdForPid(0)).toBeNull();
      expect(await resolveCwdForPid(-1)).toBeNull();
      expect(await resolveCwdForPid(-999)).toBeNull();
    });

    it("returns null for non-finite PID values", async () => {
      expect(await resolveCwdForPid(NaN)).toBeNull();
      expect(await resolveCwdForPid(Infinity)).toBeNull();
      expect(await resolveCwdForPid(-Infinity)).toBeNull();
    });
  });

  describe("on Linux", () => {
    beforeEach(() => {
      vi.spyOn(process, "platform" as any, "get").mockReturnValue("linux");
    });

    it("reads /proc/{pid}/cwd symlink when process exists", async () => {
      vi.mocked(readlink).mockResolvedValue("/home/user/project");

      const result = await resolveCwdForPid(1234);
      expect(result).toBe("/home/user/project");
      expect(readlink).toHaveBeenCalledWith("/proc/1234/cwd");
    });

    it("returns null when /proc/{pid}/cwd cannot be read", async () => {
      vi.mocked(readlink).mockRejectedValue(new Error("ENOENT"));

      const result = await resolveCwdForPid(99999);
      expect(result).toBeNull();
    });
  });

  describe("on macOS (darwin)", () => {
    beforeEach(() => {
      vi.spyOn(process, "platform" as any, "get").mockReturnValue("darwin");
    });

    it("parses cwd from lsof output", async () => {
      vi.mocked(execFile).mockImplementation(
        (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
          (cb as (...args: unknown[]) => void)(null, {
            stdout: "p1234\nn/Users/user/project\n",
            stderr: "",
          });
          return undefined as unknown as import("node:child_process").ChildProcess;
        },
      );

      const result = await resolveCwdForPid(5678);
      expect(result).toBe("/Users/user/project");
      expect(execFile).toHaveBeenCalledWith(
        "lsof",
        ["-a", "-p", "5678", "-d", "cwd", "-Fn"],
        expect.objectContaining({ timeout: expect.any(Number), windowsHide: true }),
        expect.any(Function),
      );
    });

    it("parses the 'n'-prefixed line from lsof output", async () => {
      vi.mocked(execFile).mockImplementation(
        (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
          (cb as (...args: unknown[]) => void)(null, {
            stdout: "p5678\nfcwd\nn/tmp/build\n",
            stderr: "",
          });
          return undefined as unknown as import("node:child_process").ChildProcess;
        },
      );

      const result = await resolveCwdForPid(5678);
      expect(result).toBe("/tmp/build");
    });

    it("returns null when lsof output has no cwd line", async () => {
      vi.mocked(execFile).mockImplementation(
        (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
          (cb as (...args: unknown[]) => void)(null, {
            stdout: "p5678\nfcwd\n",
            stderr: "",
          });
          return undefined as unknown as import("node:child_process").ChildProcess;
        },
      );

      const result = await resolveCwdForPid(5678);
      expect(result).toBeNull();
    });

    it("returns null when lsof fails", async () => {
      vi.mocked(execFile).mockImplementation(
        (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
          (cb as (...args: unknown[]) => void)(new Error("lsof: (process 9999) exited"));
          return undefined as unknown as import("node:child_process").ChildProcess;
        },
      );

      const result = await resolveCwdForPid(9999);
      expect(result).toBeNull();
    });
  });

  describe("on unsupported platforms", () => {
    it("returns null on Windows", async () => {
      vi.spyOn(process, "platform" as any, "get").mockReturnValue("win32");

      const result = await resolveCwdForPid(1234);
      expect(result).toBeNull();
    });

    it("returns null on other platforms", async () => {
      vi.spyOn(process, "platform" as any, "get").mockReturnValue("freebsd");

      const result = await resolveCwdForPid(1234);
      expect(result).toBeNull();
    });
  });
});
