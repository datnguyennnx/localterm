import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { OUTPUT_BATCH_MAX_BYTES, OUTPUT_BATCH_WINDOW_MS } from "../src/constants.js";
import { OutputBatcher } from "../src/output-batcher.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OutputBatcher", () => {
  it("flushes after the final chunk has been quiet for the batch window", () => {
    const flushed: Uint8Array[] = [];
    const batcher = new OutputBatcher((output) => flushed.push(output));
    batcher.push("first");
    vi.advanceTimersByTime(OUTPUT_BATCH_WINDOW_MS - 1);
    batcher.push("second");
    vi.advanceTimersByTime(OUTPUT_BATCH_WINDOW_MS - 1);
    expect(flushed).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(new TextDecoder().decode(flushed[0])).toBe("firstsecond");
  });

  it("force-flushes at the byte limit", () => {
    const flushed: Uint8Array[] = [];
    const batcher = new OutputBatcher((output) => flushed.push(output));
    batcher.push("x".repeat(OUTPUT_BATCH_MAX_BYTES));
    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.byteLength).toBe(OUTPUT_BATCH_MAX_BYTES);
  });

  it("flushes pending output synchronously before an exit control frame", () => {
    const frames: Array<string | Uint8Array> = [];
    const batcher = new OutputBatcher((output) => frames.push(output));
    batcher.push("pending");
    batcher.flush();
    frames.push('{"type":"exit","code":0}');
    const outputFrame = frames[0];
    if (!(outputFrame instanceof Uint8Array)) throw new Error("expected binary output frame");
    expect(new TextDecoder().decode(outputFrame)).toBe("pending");
    expect(frames[1]).toBe('{"type":"exit","code":0}');
  });

  it("preserves UTF-8 when a surrogate pair spans chunks", () => {
    const flushed: Uint8Array[] = [];
    const batcher = new OutputBatcher((output) => flushed.push(output));
    batcher.push("\ud83d");
    batcher.push("\ude00");
    batcher.flush();
    expect(new TextDecoder().decode(flushed[0])).toBe("😀");
  });

  it("does not force-flush between surrogate halves at the byte limit", () => {
    const flushed: Uint8Array[] = [];
    const batcher = new OutputBatcher((output) => flushed.push(output));
    batcher.push(`${"x".repeat(OUTPUT_BATCH_MAX_BYTES)}\ud83d`);
    expect(flushed).toHaveLength(0);
    batcher.push("\ude00");
    expect(flushed).toHaveLength(1);
    expect(new TextDecoder().decode(flushed[0])).toBe(`${"x".repeat(OUTPUT_BATCH_MAX_BYTES)}😀`);
  });

  it("clears pending timers and output during teardown", () => {
    const onFlush = vi.fn();
    const batcher = new OutputBatcher(onFlush);
    batcher.push("discarded");
    batcher.dispose();
    vi.runAllTimers();
    expect(onFlush).not.toHaveBeenCalled();
  });
});
