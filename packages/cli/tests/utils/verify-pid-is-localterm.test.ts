import { describe, expect, it } from "vite-plus/test";
import { DAEMON_PROCESS_TITLE } from "../../src/constants.js";
import { classifyPid } from "../../src/utils/verify-pid-is-localterm.js";

describe("classifyPid", () => {
  it("returns not-ours for invalid pids", () => {
    expect(classifyPid(0, "node")).toBe("not-ours");
    expect(classifyPid(-1, "node")).toBe("not-ours");
    expect(classifyPid(Number.NaN, "node")).toBe("not-ours");
    expect(classifyPid(1.5, "node")).toBe("not-ours");
  });

  it("returns unknown when process metadata cannot be read", () => {
    expect(classifyPid(12345, null)).toBe("unknown");
  });

  it("returns not-ours for other process names", () => {
    expect(classifyPid(process.pid, "node")).toBe("not-ours");
    expect(classifyPid(process.pid, "bash")).toBe("not-ours");
  });

  it("returns ours for the daemon process title", () => {
    expect(classifyPid(process.pid, DAEMON_PROCESS_TITLE)).toBe("ours");
  });
});
