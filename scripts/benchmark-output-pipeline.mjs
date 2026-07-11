import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { OutputBatcher } from "../packages/server/dist/output-batcher.js";

const INTERACTIVE_ECHO_COUNT = 120;
const INTERACTIVE_ECHO_INTERVAL_MS = 4;
const TUI_REDRAW_COUNT = 240;
const TUI_REDRAW_BYTES = 4096;
const LARGE_BURST_BYTES = 16 * 1024 * 1024;
const CONSTRAINED_BURST_BYTES = 4 * 1024 * 1024;
const INPUT_CHUNK_BYTES = 4096;
const DRAIN_BYTES_PER_TICK = 16 * 1024;
const DRAIN_TICK_MS = 1;
const BATCH_SETTLE_MS = 8;
const EVENT_LOOP_RESOLUTION_MS = 1;
const NANOSECONDS_PER_MS = 1_000_000;
const PERCENTILE_FIFTY = 0.5;
const PERCENTILE_NINETY_FIVE = 0.95;

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));
const immediate = () => new Promise((resolve) => setImmediate(resolve));

const percentile = (values, position) => {
  if (values.length === 0) return 0;
  const sorted = values.toSorted((first, second) => first - second);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * position))];
};

const round = (value) => Number(value.toFixed(3));

const runScenario = async (name, pushInput, onFrame) => {
  const eventLoopDelay = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  const latenciesMs = [];
  let pendingStartedAtMs = null;
  let outputBytes = 0;
  let outputFrames = 0;
  const batcher = new OutputBatcher((output) => {
    outputFrames += 1;
    outputBytes += output.byteLength;
    if (pendingStartedAtMs !== null) {
      latenciesMs.push(performance.now() - pendingStartedAtMs);
      pendingStartedAtMs = null;
    }
    onFrame?.(output);
  });
  const push = (input) => {
    if (pendingStartedAtMs === null) pendingStartedAtMs = performance.now();
    batcher.push(input);
  };

  eventLoopDelay.enable();
  const startedAtMs = performance.now();
  await pushInput(push, batcher);
  await sleep(BATCH_SETTLE_MS);
  batcher.flush();
  const durationMs = performance.now() - startedAtMs;
  eventLoopDelay.disable();
  const heapAfterBytes = process.memoryUsage().heapUsed;
  batcher.dispose();

  return {
    name,
    durationMs: round(durationMs),
    outputFrames,
    outputBytes,
    latencyP50Ms: round(percentile(latenciesMs, PERCENTILE_FIFTY)),
    latencyP95Ms: round(percentile(latenciesMs, PERCENTILE_NINETY_FIVE)),
    eventLoopMeanMs: round(eventLoopDelay.mean / NANOSECONDS_PER_MS),
    eventLoopP99Ms: round(eventLoopDelay.percentile(99) / NANOSECONDS_PER_MS),
    heapDeltaBytes: heapAfterBytes - heapBeforeBytes,
  };
};

const createAsciiChunk = (sizeBytes, character) => character.repeat(sizeBytes);

const runInteractiveEcho = () =>
  runScenario("interactive-echo", async (push) => {
    for (let echoIndex = 0; echoIndex < INTERACTIVE_ECHO_COUNT; echoIndex += 1) {
      push("x");
      await sleep(INTERACTIVE_ECHO_INTERVAL_MS);
    }
  });

const runTuiRedraw = () =>
  runScenario("tui-redraw", async (push) => {
    const redraw = `\u001b[H${createAsciiChunk(TUI_REDRAW_BYTES - 3, "r")}`;
    for (let redrawIndex = 0; redrawIndex < TUI_REDRAW_COUNT; redrawIndex += 1) {
      push(redraw);
      await immediate();
    }
  });

const runLargeBurst = () =>
  runScenario("large-burst", async (push) => {
    const chunk = createAsciiChunk(INPUT_CHUNK_BYTES, "b");
    for (let sentBytes = 0; sentBytes < LARGE_BURST_BYTES; sentBytes += chunk.length) {
      push(chunk);
    }
  });

const runConstrainedDrain = async () => {
  const startedAtMs = performance.now();
  let queuedBytes = 0;
  let peakQueuedBytes = 0;
  const drainTimer = setInterval(() => {
    queuedBytes = Math.max(0, queuedBytes - DRAIN_BYTES_PER_TICK);
  }, DRAIN_TICK_MS);
  const result = await runScenario(
    "constrained-drain",
    async (push) => {
      const chunk = createAsciiChunk(INPUT_CHUNK_BYTES, "d");
      for (let sentBytes = 0; sentBytes < CONSTRAINED_BURST_BYTES; sentBytes += chunk.length) {
        push(chunk);
      }
    },
    (frame) => {
      queuedBytes += frame.byteLength;
      peakQueuedBytes = Math.max(peakQueuedBytes, queuedBytes);
    },
  );
  while (queuedBytes > 0) await sleep(DRAIN_TICK_MS);
  clearInterval(drainTimer);
  return {
    ...result,
    durationMs: round(performance.now() - startedAtMs),
    producerDurationMs: result.durationMs,
    peakQueuedBytes,
  };
};

const results = [];
results.push(await runInteractiveEcho());
results.push(await runTuiRedraw());
results.push(await runLargeBurst());
results.push(await runConstrainedDrain());
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
