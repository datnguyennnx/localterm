import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHELL_VERSION_LENGTH = 12;
const FONT_EXTENSIONS = [".woff", ".woff2", ".ttf", ".otf"];
const ICON_EXTENSIONS = [".svg", ".png", ".ico"];
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(moduleDirectory, "..", "dist");
const templatePath = path.resolve(moduleDirectory, "sw-template.js");
const outputPath = path.join(distDirectory, "sw.js");

const toUrl = (distPath) => {
  const relative = path.relative(distDirectory, distPath).split(path.sep).join("/");
  return relative === "index.html" ? "/" : `/${relative}`;
};

const extractShellUrls = () => {
  const html = readFileSync(path.join(distDirectory, "index.html"), "utf8");
  const urls = new Set();
  const attributePattern = /(?:src|href)\s*=\s*"([^"]+)"/g;
  let match = attributePattern.exec(html);
  while (match !== null) {
    const value = match[1];
    if (value.startsWith("/")) urls.add(value);
    match = attributePattern.exec(html);
  }
  return urls;
};

const collectAssetUrlsByExtension = (extensions) => {
  const urls = new Set();
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
        urls.add(toUrl(fullPath));
      }
    }
  };
  walk(distDirectory);
  return urls;
};

const isPrecacheable = (url) => !url.endsWith(".map") && url !== "/sw.js";

const contentHashOf = (url) => {
  const distPath =
    url === "/" ? path.join(distDirectory, "index.html") : path.join(distDirectory, url);
  if (!existsSync(distPath)) return null;
  return createHash("sha1").update(readFileSync(distPath)).digest("hex");
};

const buildVersion = (urls) => {
  const hasher = createHash("sha1");
  for (const url of urls) {
    const hash = contentHashOf(url);
    if (hash) hasher.update(`${url}:${hash}\n`);
  }
  return hasher.digest("hex").slice(0, SHELL_VERSION_LENGTH);
};

const main = () => {
  if (!existsSync(distDirectory)) {
    throw new Error(`dist not found at ${distDirectory}`);
  }
  if (!existsSync(templatePath)) {
    throw new Error(`service worker template not found at ${templatePath}`);
  }

  const shellUrls = extractShellUrls();
  const fontUrls = collectAssetUrlsByExtension(FONT_EXTENSIONS);
  const iconUrls = collectAssetUrlsByExtension(ICON_EXTENSIONS);
  const precacheUrls = ["/", ...shellUrls, ...fontUrls, ...iconUrls]
    .filter(isPrecacheable)
    .toSorted();
  const uniquePrecacheUrls = [...new Set(precacheUrls)];
  const version = buildVersion(uniquePrecacheUrls);
  const template = readFileSync(templatePath, "utf8");
  const serviceWorker = template
    .replaceAll('"__SW_VERSION__"', JSON.stringify(version))
    .replace("__PRECACHE_URLS_JSON__", JSON.stringify(JSON.stringify(uniquePrecacheUrls)));

  writeFileSync(outputPath, serviceWorker);
  console.log(
    `generated ${path.relative(moduleDirectory, outputPath)} (v${version}, ${uniquePrecacheUrls.length} precache entries)`,
  );
};

main();
