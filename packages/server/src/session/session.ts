import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type IPty } from "node-pty";
import {
  COLORTERM_VALUE,
  CWD_RESOLVE_BACKOFF_MS,
  CWD_RESOLVE_COOLDOWN_MS,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  PTY_ENV_DENYLIST,
  SESSION_PARK_GRACE_PERIOD_MS,
  TAIL_BUFFER_MAX_BYTES,
  TERM_TYPE,
  TITLE_POLL_INTERVAL_MS,
} from "../constants.js";
// Note: titles are emitted on a dedicated `title` event so they travel as a
// separate WebSocket frame. We deliberately do NOT splice OSC sequences into
// the PTY output stream — doing so corrupts in-flight escape sequences from
// modern TUIs (e.g. Cursor Agent / Claude Code use DECSET 2026 synchronized
// output mode and any byte landing inside that frame breaks the parser state).
import { ensureSpawnHelperExecutable } from "./ensure-spawn-helper-executable.js";
import { getDefaultShell } from "./default-shell.js";
import { OscChunkParser } from "../parser/osc.js";
import { parseOsc133FromChunk, type CommandBoundary } from "../parser/parse-osc133-from-chunk.js";
import { parseOsc7FromChunk } from "../parser/parse-osc7-from-chunk.js";
import type { SpawnPtyInput } from "../types.js";
import { formatWorkingDirectoryTitle } from "../utils/format-working-directory-title.js";
import { resolveCwdForPid } from "../utils/resolve-cwd-for-pid.js";

interface SessionEvents {
  output: [data: string];
  exit: [code: number | null];
  title: [title: string];
  cwd: [cwd: string];
  commandBoundary: [boundary: CommandBoundary];
}

export class Session extends EventEmitter<SessionEvents> {
  readonly id: string;
  readonly shell: string;
  readonly cwd: string;
  readonly createdAt: number;
  readonly mode: "human" | "agent";

  private readonly pty: IPty;
  private readonly shellName: string;
  private currentCols: number;
  private currentRows: number;
  private exited = false;
  private paused = false;
  private parked = false;
  private cancelParkTimer: (() => void) | null = null;
  private readonly tailBuffer: string[] = [];
  private tailBufferBytes = 0;
  private titlePollTimer: NodeJS.Timeout | null = null;
  private lastEmittedTitle = "";
  private lastEmittedCwd = "";
  private nextCwdResolveAt = 0;
  private osc7Detected = false;
  private readonly osc7ChunkParser = new OscChunkParser(parseOsc7FromChunk);
  private readonly osc133ChunkParser = new OscChunkParser(parseOsc133FromChunk);
  private readonly ptyDataDisposable: { dispose: () => void };
  private readonly ptyExitDisposable: { dispose: () => void };

  /** Called by destroy() before cleanup. Used by SessionRegistry to unregister. */
  onDestroy: (() => void) | null = null;

  constructor(input: SpawnPtyInput) {
    super();
    this.id = randomUUID();
    ensureSpawnHelperExecutable();
    this.shell = input.shell ?? getDefaultShell();
    this.shellName = path.basename(this.shell);
    this.cwd = input.cwd ?? os.homedir();
    this.currentCols = input.cols ?? DEFAULT_COLS;
    this.currentRows = input.rows ?? DEFAULT_ROWS;
    this.createdAt = Date.now();
    this.mode = input.mode ?? "human";

    const env: Record<string, string> = {};
    const denied = new Set(PTY_ENV_DENYLIST);
    for (const [key, value] of Object.entries(process.env)) {
      if (denied.has(key)) continue;
      if (typeof value === "string") env[key] = value;
    }
    if (input.env) {
      for (const [key, value] of Object.entries(input.env)) {
        env[key] = value;
      }
    }
    env.TERM = TERM_TYPE;
    env.COLORTERM = COLORTERM_VALUE;

    this.pty = spawn(this.shell, [], {
      name: TERM_TYPE,
      cols: this.currentCols,
      rows: this.currentRows,
      cwd: this.cwd,
      env,
    });

    this.ptyDataDisposable = this.pty.onData((data) => {
      this.onPtyOutput(data);
      this.emit("output", data);
    });

    this.ptyExitDisposable = this.pty.onExit(({ exitCode }) => {
      this.exited = true;
      this.stopTitlePolling();
      this.emit("exit", exitCode);
    });

    this.scheduleTitlePoll(0);
  }

  get pid(): number {
    return this.pty.pid;
  }

  get shellBaseName(): string {
    return this.shellName;
  }

  get cols(): number {
    return this.currentCols;
  }

  get rows(): number {
    return this.currentRows;
  }

  get isExited(): boolean {
    return this.exited;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  write(data: string): void {
    if (this.exited) return;
    this.pty.write(data);
  }

  /**
   * Stop reading data from the PTY. node-pty buffers further child output in
   * the OS pipe; once that fills, write() in the child process blocks, which
   * propagates flow control all the way back to the producing program (e.g.
   * `cat large_file`). Used by the WS layer to pause heavy output streams
   * when the outbound socket buffer is filling, so we don't have to kill the
   * connection just to recover memory.
   */
  pause(): void {
    if (this.exited || this.paused) return;
    this.paused = true;
    try {
      this.pty.pause();
    } catch {
      /* PTY may have died between the exited check and the call */
    }
  }

  /**
   * Reverse of `pause()`. Buffered child output starts flowing again and the
   * child process unblocks if it was stuck in write().
   */
  resume(): void {
    if (this.exited || !this.paused) return;
    this.paused = false;
    try {
      this.pty.resume();
    } catch {
      /* see pause() */
    }
  }

  resize(cols: number, rows: number): void {
    if (this.exited) return;
    if (cols <= 0 || rows <= 0) return;
    if (cols === this.currentCols && rows === this.currentRows) return;
    this.currentCols = cols;
    this.currentRows = rows;
    try {
      this.pty.resize(cols, rows);
    } catch {
      /* PTY may have died between checks */
    }
  }

  kill(signal: NodeJS.Signals = "SIGHUP"): void {
    if (this.exited) return;
    try {
      this.pty.kill(signal);
    } catch {
      /* already gone */
    }
  }

  /**
   * Park the session: stop sending output to a WebSocket but keep the PTY
   * running. Starts a grace timer; if reattach doesn't arrive in time,
   * the session is destroyed. Output during park is captured in the tail
   * buffer (bounded to TAIL_BUFFER_MAX_BYTES).
   */
  park(gracePeriodMs: number = SESSION_PARK_GRACE_PERIOD_MS): void {
    if (this.exited || this.parked) return;
    this.parked = true;

    if (gracePeriodMs > 0) {
      const timer = setTimeout(() => {
        this.destroy();
      }, gracePeriodMs);
      timer.unref();
      this.cancelParkTimer = () => {
        clearTimeout(timer);
        this.cancelParkTimer = null;
      };
    }
  }

  /**
   * Cancel the park timer (called when session is reattached).
   */
  cancelPark(): void {
    if (this.cancelParkTimer) {
      this.cancelParkTimer();
    }
    this.parked = false;
  }

  /**
   * Get the tail buffer and clear it. Returns a copy so the caller can
   * replay it on a new WebSocket.
   */
  drainTailBuffer(): string[] {
    const buffer = [...this.tailBuffer];
    this.tailBuffer.length = 0;
    this.tailBufferBytes = 0;
    return buffer;
  }

  /**
   * Full destroy — kills the PTY, clears all state. This is the terminal
   * end of a session's life. Called when the grace period expires, during
   * server shutdown (disposeAll), or on explicit kill.
   */
  destroy(): void {
    this.onDestroy?.();
    if (this.exited) {
      this.ptyDataDisposable.dispose();
      this.ptyExitDisposable.dispose();
      this.removeAllListeners();
      this.tailBuffer.length = 0;
      this.tailBufferBytes = 0;
      return;
    }
    this.parked = false;
    this.cancelPark();
    this.kill();
    this.exited = true;
    this.stopTitlePolling();
    this.osc7ChunkParser.reset();
    this.osc133ChunkParser.reset();
    this.ptyDataDisposable.dispose();
    this.ptyExitDisposable.dispose();
    this.removeAllListeners();
    this.tailBuffer.length = 0;
    this.tailBufferBytes = 0;
  }

  private onPtyOutput(data: string): void {
    const osc7Path = this.osc7ChunkParser.push(data);
    if (osc7Path) {
      this.osc7Detected = true;
      if (osc7Path !== this.lastEmittedCwd) {
        this.lastEmittedCwd = osc7Path;
        this.emit("cwd", osc7Path);
      }
    }

    // OSC 133 / FinalTerm command boundary detection.
    const boundary = this.osc133ChunkParser.push(data);
    if (boundary) {
      this.emit("commandBoundary", boundary);
    }

    // If parked, capture output in the tail buffer for replay on reattach.
    if (this.parked && !this.exited) {
      this.tailBuffer.push(data);
      this.tailBufferBytes += Buffer.byteLength(data, "utf-8");
      while (this.tailBufferBytes > TAIL_BUFFER_MAX_BYTES && this.tailBuffer.length > 0) {
        const removed = this.tailBuffer.shift()!;
        this.tailBufferBytes -= Buffer.byteLength(removed, "utf-8");
      }
    }
  }

  private scheduleTitlePoll(delayMs: number): void {
    if (this.exited) return;
    this.titlePollTimer = setTimeout(() => {
      void this.runTitlePoll();
    }, delayMs);
    this.titlePollTimer.unref();
  }

  private async runTitlePoll(): Promise<void> {
    if (this.exited) return;
    try {
      const liveCwd = this.osc7Detected ? this.lastEmittedCwd || null : await this.resolveLiveCwd();
      if (this.exited) return;
      if (!this.osc7Detected && liveCwd && liveCwd !== this.lastEmittedCwd) {
        this.lastEmittedCwd = liveCwd;
        this.emit("cwd", liveCwd);
      }
      const nextTitle = this.computeTitle(liveCwd);
      if (nextTitle && nextTitle !== this.lastEmittedTitle) {
        this.lastEmittedTitle = nextTitle;
        this.emit("title", nextTitle);
      }
    } catch {
      /* polling errors are non-fatal; the next tick will retry */
    } finally {
      this.scheduleTitlePoll(TITLE_POLL_INTERVAL_MS);
    }
  }

  private computeTitle(liveCwd: string | null): string | null {
    let foreground = "";
    try {
      foreground = this.pty.process?.trim() ?? "";
    } catch {
      // pty.process can throw in some node-pty versions when the process is destroyed
    }
    if (foreground && foreground !== this.shellName) return foreground;
    return formatWorkingDirectoryTitle(liveCwd ?? this.cwd);
  }

  private async resolveLiveCwd(): Promise<string | null> {
    const now = Date.now();
    if (now < this.nextCwdResolveAt) return null;
    const liveCwd = await resolveCwdForPid(this.pid).catch(() => null);
    this.nextCwdResolveAt =
      now + (liveCwd === null ? CWD_RESOLVE_BACKOFF_MS : CWD_RESOLVE_COOLDOWN_MS);
    return liveCwd;
  }

  private stopTitlePolling(): void {
    if (this.titlePollTimer === null) return;
    clearTimeout(this.titlePollTimer);
    this.titlePollTimer = null;
  }
}
