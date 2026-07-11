import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PNG_WIDTH_OFFSET_BYTES = 16;
const PNG_HEIGHT_OFFSET_BYTES = 20;
const ICON_SMALL_SIZE_PX = 192;
const ICON_LARGE_SIZE_PX = 512;
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(rootDirectory, "apps", "terminal", "dist");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertFileExists = (relativePath) => {
  assert(
    existsSync(path.join(distDirectory, relativePath)),
    `PWA artifact missing: ${relativePath}`,
  );
};

const readPngSize = (relativePath) => {
  const contents = readFileSync(path.join(distDirectory, relativePath));
  return {
    width: contents.readUInt32BE(PNG_WIDTH_OFFSET_BYTES),
    height: contents.readUInt32BE(PNG_HEIGHT_OFFSET_BYTES),
  };
};

for (const relativePath of [
  "sw.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
]) {
  assertFileExists(relativePath);
}

const manifest = JSON.parse(readFileSync(path.join(distDirectory, "manifest.webmanifest"), "utf8"));
assert(manifest.id === "/", "PWA manifest must use a stable root id");
assert(manifest.orientation === "any", "PWA manifest must remain responsive in both orientations");
assert(manifest.display === "standalone", "PWA manifest must launch standalone");
for (const icon of manifest.icons) {
  assertFileExists(icon.src.replace(/^\//, ""));
}
assert(
  manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose.includes("maskable")),
  "PWA manifest must include a maskable 192px icon",
);
assert(
  manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose.includes("maskable")),
  "PWA manifest must include a maskable 512px icon",
);

const smallIconSize = readPngSize("icons/icon-192.png");
const largeIconSize = readPngSize("icons/icon-512.png");
assert(
  smallIconSize.width === ICON_SMALL_SIZE_PX && smallIconSize.height === ICON_SMALL_SIZE_PX,
  "Generated small PWA icon has incorrect dimensions",
);
assert(
  largeIconSize.width === ICON_LARGE_SIZE_PX && largeIconSize.height === ICON_LARGE_SIZE_PX,
  "Generated large PWA icon has incorrect dimensions",
);

const builtHtml = readFileSync(path.join(distDirectory, "index.html"), "utf8");
assert(
  builtHtml.includes('rel="manifest" href="/manifest.webmanifest"'),
  "Built app shell must link the PWA manifest",
);
assert(
  builtHtml.includes('rel="apple-touch-icon" href="/icons/icon-192.png"'),
  "Built app shell must link the Apple touch icon",
);
assert(
  builtHtml.includes("interactive-widget=resizes-content"),
  "Built viewport metadata must request native keyboard resizing",
);

const serviceWorker = readFileSync(path.join(distDirectory, "sw.js"), "utf8");
const precacheMatch = serviceWorker.match(/const PRECACHE_URLS = JSON\.parse\((.+)\);/);
assert(precacheMatch?.[1], "Generated service worker is missing its precache list");
const precacheUrls = JSON.parse(JSON.parse(precacheMatch[1]));
for (const url of precacheUrls) {
  const relativePath = url === "/" ? "index.html" : url.replace(/^\//, "");
  assertFileExists(relativePath);
  assert(!url.endsWith(".map"), `Source map must not be precached: ${url}`);
  assert(url !== "/sw.js", "Service worker must not precache itself");
  assert(!url.startsWith("/api/"), `API path must not be precached: ${url}`);
  assert(url !== "/ws", "WebSocket path must not be precached");
}
assert(
  serviceWorker.includes('!url.pathname.startsWith("/api/")') &&
    serviceWorker.includes('url.pathname !== "/ws"'),
  "Service worker must bypass terminal API and WebSocket traffic",
);
