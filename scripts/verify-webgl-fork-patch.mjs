import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const terminalRequire = createRequire(new URL("../apps/terminal/package.json", import.meta.url));
const commonJsEntry = terminalRequire.resolve("@xterm/addon-webgl");
const moduleEntry = commonJsEntry.replace(/\.js$/, ".mjs");
const addonSource = readFileSync(moduleEntry, "utf8");
const requiredPatterns = [
  "dot(texel.rgb, vec3(0.299, 0.587, 0.114))",
  "resolveFgColor",
  'this._tmpCtx.fillStyle="#ffffff"',
  'this._tmpCtx.strokeStyle="#ffffff"',
  "this._ltFontHash",
  "c.devicePixelRatio*1000",
  "c.fontFamily?c.fontFamily.length:0",
  "trailing overhang budget",
  "Math.ceil(this._config.deviceCellWidth*0.5)",
];

for (const requiredPattern of requiredPatterns) {
  if (!addonSource.includes(requiredPattern)) {
    throw new Error(`WebGL fork patch signature missing: ${requiredPattern}`);
  }
}
