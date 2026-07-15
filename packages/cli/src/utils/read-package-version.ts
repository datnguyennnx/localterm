import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(moduleDir, "../../package.json");

export const readPackageVersion = (): string => {
  const content = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
  if (typeof content.version !== "string" || content.version.length === 0) {
    throw new Error("package.json version is missing or empty");
  }
  return content.version;
};
