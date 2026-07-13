import { z } from "zod";
import {
  MAX_COLS,
  MAX_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  MAX_ROWS,
  MAX_TITLE_LENGTH,
} from "./constants.js";

export const healthSchema = z
  .object({
    ok: z.boolean(),
    sessions: z.number().int().nonnegative(),
  })
  .strict();

const inputMessageSchema = z
  .object({
    type: z.literal("input"),
    data: z.string().max(MAX_INPUT_BYTES),
  })
  .strict();

const resizeMessageSchema = z
  .object({
    type: z.literal("resize"),
    cols: z.number().int().positive().max(MAX_COLS),
    rows: z.number().int().positive().max(MAX_ROWS),
  })
  .strict();

const flowPauseMessageSchema = z
  .object({
    type: z.literal("flow-pause"),
  })
  .strict();

const flowResumeMessageSchema = z
  .object({
    type: z.literal("flow-resume"),
  })
  .strict();

const rpcRequestMessageSchema = z
  .object({
    type: z.literal("rpc"),
    id: z.string().min(1).max(64),
    method: z.enum([
      "spawn_session",
      "list_sessions",
      "write_input",
      "read_output",
      "wait_for_boundary",
      "exec",
    ]),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const clientToServerMessageSchema = z.discriminatedUnion("type", [
  inputMessageSchema,
  resizeMessageSchema,
  flowPauseMessageSchema,
  flowResumeMessageSchema,
  rpcRequestMessageSchema,
]);

const outputMessageSchema = z
  .object({
    type: z.literal("output"),
    data: z.string().max(MAX_OUTPUT_BYTES),
  })
  .strict();

const exitMessageSchema = z
  .object({
    type: z.literal("exit"),
    code: z.number().int().nullable(),
  })
  .strict();

const titleMessageSchema = z
  .object({
    type: z.literal("title"),
    title: z.string().max(MAX_TITLE_LENGTH),
  })
  .strict();

const sessionMessageSchema = z
  .object({
    type: z.literal("session"),
    shell: z.string().min(1),
    shellName: z.string().min(1),
    pid: z.number().int().nonnegative(),
    cwd: z.string().min(1),
  })
  .strict();

const cwdMessageSchema = z
  .object({
    type: z.literal("cwd"),
    cwd: z.string().min(1),
  })
  .strict();

const agentOutputMessageSchema = z
  .object({
    type: z.literal("agent-output"),
    text: z.string(),
  })
  .strict();

const commandBoundaryMessageSchema = z
  .object({
    type: z.literal("command-boundary"),
    phase: z.enum(["prompt-start", "command-start", "output-start", "command-end"]),
    exitCode: z.number().int().optional(),
  })
  .strict();

const rpcResponseMessageSchema = z
  .object({
    type: z.literal("rpc-response"),
    id: z.string().min(1).max(64),
    result: z.unknown().optional(),
    error: z.string().optional(),
  })
  .strict();

export const serverToClientMessageSchema = z.discriminatedUnion("type", [
  outputMessageSchema,
  exitMessageSchema,
  titleMessageSchema,
  sessionMessageSchema,
  cwdMessageSchema,
  agentOutputMessageSchema,
  commandBoundaryMessageSchema,
  rpcResponseMessageSchema,
]);
