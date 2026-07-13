import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");

const SCRIPT_CACHE = new Map<string, string>();

const loadScript = (name: string): string => {
  const cached = SCRIPT_CACHE.get(name);
  if (cached !== undefined) return cached;
  const content = readFileSync(join(__dirname, name), "utf-8");
  SCRIPT_CACHE.set(name, content);
  return content;
};

/**
 * Return the shell integration script for the given shell basename.
 * Returns an empty string for unsupported shells (graceful degradation).
 */
export const getShellIntegrationScript = (shellBaseName: string): string => {
  switch (shellBaseName) {
    case "bash":
      return loadScript("bash.sh");
    case "zsh":
      return loadScript("zsh.sh");
    default:
      return "";
  }
};

export const SHELL_INTEGRATION_ENV_VAR = "LOCALTERM_SHELL_INTEGRATION";
