import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { createServer } from "../src/server/index.js";

describe("createServer", () => {
  it("reports the actual port selected for an ephemeral bind", async () => {
    const server = await createServer({ port: 0, staticRoot: null });
    try {
      expect(server.port).toBeGreaterThan(0);
    } finally {
      await server.stop();
    }
  });

  it("forces service worker and manifest revalidation", async () => {
    const staticRoot = mkdtempSync(path.join(os.tmpdir(), "localterm-pwa-static-"));
    writeFileSync(path.join(staticRoot, "index.html"), "<!doctype html>");
    writeFileSync(path.join(staticRoot, "sw.js"), "self.addEventListener('fetch', () => {});");
    writeFileSync(path.join(staticRoot, "manifest.webmanifest"), "{}");
    const server = await createServer({ port: 0, staticRoot });
    try {
      const origin = `http://${server.host}:${server.port}`;
      const workerResponse = await fetch(`${origin}/sw.js`);
      const manifestResponse = await fetch(`${origin}/manifest.webmanifest`);
      expect(workerResponse.headers.get("cache-control")).toBe("no-cache");
      expect(manifestResponse.headers.get("cache-control")).toBe("no-cache");
      expect(manifestResponse.headers.get("content-type")).toBe(
        "application/manifest+json; charset=utf-8",
      );
    } finally {
      await server.stop();
    }
  });
});
