import { describe, expect, it } from "vite-plus/test";
import { buildFaviconSvg } from "../../../../src/features/terminal/favicon/build-favicon-svg";

describe("buildFaviconSvg", () => {
  it("returns a valid SVG string wrapping the output", () => {
    const svg = buildFaviconSvg(0, "idle");
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("includes the idle glyph path for 'idle' state", () => {
    const svg = buildFaviconSvg(120, "idle");
    expect(svg).toContain("d='m6 8 4 4-4 4M12 16h6'");
  });

  it("includes three circle elements for 'active' state", () => {
    const svg = buildFaviconSvg(200, "active");
    const circleMatches = svg.match(/<circle /g);
    expect(circleMatches).toHaveLength(3);
  });

  it("sets reduced opacity for 'dead' state", () => {
    const svg = buildFaviconSvg(300, "dead");
    expect(svg).toContain("opacity='0.35'");
  });

  it("uses full opacity for non-dead states", () => {
    expect(buildFaviconSvg(0, "idle")).toContain("opacity='1'");
    expect(buildFaviconSvg(0, "active")).toContain("opacity='1'");
  });

  it("clamps hue = 360 to 0 (wraps around)", () => {
    const svg360 = buildFaviconSvg(360, "idle");
    const svg0 = buildFaviconSvg(0, "idle");
    expect(svg360).toBe(svg0);
  });

  it("clamps negative hue to a positive equivalent", () => {
    const svgMinus45 = buildFaviconSvg(-45, "idle");
    const svg315 = buildFaviconSvg(315, "idle");
    expect(svgMinus45).toBe(svg315);
  });

  it("clamps hue > 360 to the equivalent position on the wheel", () => {
    const svg720 = buildFaviconSvg(720, "idle");
    const svg0 = buildFaviconSvg(0, "idle");
    expect(svg720).toBe(svg0);
  });

  it("produces a hue-dependent fill color in hsl notation", () => {
    const svg = buildFaviconSvg(180, "idle");
    expect(svg).toContain("hsl(180 80% 62%)");
  });

  it("produces a hue-dependent ink color in hsl notation", () => {
    const svg = buildFaviconSvg(90, "idle");
    expect(svg).toContain("hsl(90 85% 12%)");
  });

  it("includes a rounded rectangle background", () => {
    const svg = buildFaviconSvg(0, "idle");
    expect(svg).toContain("<rect ");
    expect(svg).toContain("rx='2'");
  });
});
