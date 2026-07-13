import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const LOCALTERM_DIR = join(homedir(), ".localterm");
const TOKEN_FILE = join(LOCALTERM_DIR, "agent-token");
const TOKEN_BYTES = 32; // 256-bit token

/**
 * Generate a cryptographically random hex token.
 */
const generateToken = (): string => {
  return randomBytes(TOKEN_BYTES).toString("hex");
};

/**
 * Load the agent token from ~/.localterm/agent-token.
 * If the file doesn't exist, generate a new token, write it with 0600 perms,
 * and return it.  This ensures every `localterm start` gets a fresh token
 * and the file persists across the daemon's lifetime.
 *
 * Token is used for authenticating agent-mode WebSocket connections.
 * Human-mode connections (default) do not require a token.
 */
export const loadOrCreateAgentToken = (): string => {
  if (existsSync(TOKEN_FILE)) {
    const raw = readFileSync(TOKEN_FILE, "utf-8").trim();
    if (raw.length > 0) return raw;
  }
  const token = generateToken();
  if (!existsSync(LOCALTERM_DIR)) {
    mkdirSync(LOCALTERM_DIR, { recursive: true, mode: 0o755 });
  }
  writeFileSync(TOKEN_FILE, token + "\n", { mode: 0o600, encoding: "utf-8" });
  return token;
};

/**
 * Validate a candidate token against the stored agent token.
 * Returns true if the token matches (constant-time comparison not required —
 * this is a local-only security boundary; timing attacks assume network access).
 */
export const validateAgentToken = (candidate: string): boolean => {
  if (!existsSync(TOKEN_FILE)) return false;
  const stored = readFileSync(TOKEN_FILE, "utf-8").trim();
  if (!stored) return false;
  return candidate === stored;
};

/**
 * Get the path to the agent token file (for CLI display / docs).
 */
export const getAgentTokenPath = (): string => TOKEN_FILE;
