import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { syncAppleWebKitViewport } from "../../src/utils/sync-apple-webkit-viewport";

class FakeVisualViewport extends EventTarget implements VisualViewport {
  height = 540;
  offsetLeft = 0;
  offsetTop = 24;
  onresize = null;
  onscroll = null;
  pageLeft = 0;
  pageTop = 0;
  scale = 1;
  width = 390;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncAppleWebKitViewport", () => {
  it("coalesces resize and scroll updates into one animation frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const root = document.createElement("div");
    const visualViewport = new FakeVisualViewport();

    const cleanup = syncAppleWebKitViewport(root, visualViewport);
    visualViewport.dispatchEvent(new Event("resize"));
    visualViewport.dispatchEvent(new Event("scroll"));

    expect(frames).toHaveLength(1);
    frames[0]?.(0);
    expect(root.style.height).toBe("540px");
    expect(root.style.transform).toBe("translateY(24px)");

    visualViewport.height = 420;
    visualViewport.offsetTop = 0;
    visualViewport.dispatchEvent(new Event("resize"));
    expect(frames).toHaveLength(2);
    frames[1]?.(0);
    expect(root.style.height).toBe("420px");
    expect(root.style.transform).toBe("");

    cleanup();
    expect(root.style.height).toBe("");
    expect(root.style.transform).toBe("");
  });
});
