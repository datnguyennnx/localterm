import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RASTER_DENSITY_DPI = 2048;
const ICON_SMALL_SIZE_PX = 192;
const ICON_LARGE_SIZE_PX = 512;
const BACKGROUND_HEX = "#f4f4f5";
const ICON_TARGETS = [
  { name: "icon-192.png", size: ICON_SMALL_SIZE_PX },
  { name: "icon-512.png", size: ICON_LARGE_SIZE_PX },
];

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const iconsDirectory = path.resolve(moduleDirectory, "..", "public", "icons");
const source = readFileSync(path.join(iconsDirectory, "icon.svg"));

const renderIcon = (size) =>
  sharp(source, { density: RASTER_DENSITY_DPI })
    .resize(size, size)
    .flatten({ background: BACKGROUND_HEX })
    .png();

const main = async () => {
  for (const { name, size } of ICON_TARGETS) {
    await renderIcon(size).toFile(path.join(iconsDirectory, name));
    console.log(`generated icons/${name} (${size}x${size})`);
  }
};

await main();
