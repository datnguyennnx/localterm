import { OUTPUT_BATCH_MAX_BYTES, OUTPUT_BATCH_WINDOW_MS } from "./constants.js";

const TRAILING_HIGH_SURROGATE_PATTERN = /[\uD800-\uDBFF]$/;

export class OutputBatcher {
  private readonly chunks: string[] = [];
  private bufferedBytes = 0;
  private timer: NodeJS.Timeout | null = null;
  private lastEndedWithHighSurrogate = false;

  constructor(private readonly onFlush: (output: Uint8Array) => void) {}

  push(data: string): void {
    if (!data) return;
    this.chunks.push(data);
    this.bufferedBytes += Buffer.byteLength(data);
    this.lastEndedWithHighSurrogate = TRAILING_HIGH_SURROGATE_PATTERN.test(data);
    if (
      this.bufferedBytes >= OUTPUT_BATCH_MAX_BYTES &&
      !this.lastEndedWithHighSurrogate
    ) {
      this.flush();
      return;
    }
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), OUTPUT_BATCH_WINDOW_MS);
    this.timer.unref();
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.chunks.length === 0) return;
    const output = new TextEncoder().encode(this.chunks.join(""));
    this.chunks.length = 0;
    this.bufferedBytes = 0;
    this.onFlush(output);
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.chunks.length = 0;
    this.bufferedBytes = 0;
  }
}
