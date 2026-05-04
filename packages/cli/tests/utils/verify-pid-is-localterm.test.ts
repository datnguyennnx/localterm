import { afterEach, describe, expect, it } from "vite-plus/test";
import { DAEMON_PROCESS_TITLE } from "../../src/constants.js";
import { verifyPidIsLocalterm } from "../../src/utils/verify-pid-is-localterm.js";

const originalProcessTitle = process.title;

afterEach(() => {
  process.title = originalProcessTitle;
});

describe("verifyPidIsLocalterm", () => {
  it("rejects non-positive or non-integer pids without spawning a probe", async () => {
    expect(await verifyPidIsLocalterm(0)).toBe(false);
    expect(await verifyPidIsLocalterm(-1)).toBe(false);
    expect(await verifyPidIsLocalterm(Number.NaN)).toBe(false);
    expect(await verifyPidIsLocalterm(1.5)).toBe(false);
  });

  it("returns false for a pid that does not exist", async () => {
    expect(await verifyPidIsLocalterm(2_147_483_640)).toBe(false);
  });

  it("returns false for a live process whose comm is not the daemon title", async () => {
    expect(await verifyPidIsLocalterm(process.pid)).toBe(false);
  });

  it("returns true for a live process whose comm matches the daemon title", async () => {
    process.title = DAEMON_PROCESS_TITLE;
    expect(await verifyPidIsLocalterm(process.pid)).toBe(true);
  });
});
