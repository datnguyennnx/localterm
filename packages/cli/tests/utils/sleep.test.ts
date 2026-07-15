import { describe, expect, it } from "vite-plus/test";
import { sleep } from "../../src/utils/sleep.js";

describe("sleep", () => {
  it("resolves after the specified duration", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it("resolves to undefined", async () => {
    const result = await sleep(1);
    expect(result).toBeUndefined();
  });

  it("handles a duration of zero", async () => {
    await expect(sleep(0)).resolves.toBeUndefined();
  });
});
