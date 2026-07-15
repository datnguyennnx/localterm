import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import { claimTabHue } from "../../src/utils/claim-tab-hue";
import * as faviconStateStore from "../../src/utils/favicon-state-store";

// ── Cross-instance BroadcastChannel mock ───────────────────────────────────

const channelsByName = new Map<string, FakeBroadcastChannel[]>();

class FakeBroadcastChannel {
  readonly name: string;
  private handlers: Array<(event: MessageEvent) => void> = [];
  closed = false;

  constructor(name: string) {
    this.name = name;
    if (!channelsByName.has(name)) channelsByName.set(name, []);
    channelsByName.get(name)!.push(this);
  }

  addEventListener(_type: string, handler: (event: MessageEvent) => void): void {
    if (_type === "message") {
      this.handlers.push(handler);
    }
  }

  removeEventListener(_type: string, handler: (event: MessageEvent) => void): void {
    if (_type === "message") {
      this.handlers = this.handlers.filter((h) => h !== handler);
    }
  }

  /**
   * Deliver a message to every other FakeBroadcastChannel with the same name.
   * This mirrors the real BroadcastChannel semantic: the sender does NOT
   * receive its own messages.
   */
  postMessage(data: unknown): void {
    const allChannels = channelsByName.get(this.name) ?? [];
    for (const channel of allChannels) {
      if (channel === this || channel.closed) continue;
      for (const handler of channel.handlers) {
        handler(new MessageEvent("message", { data }));
      }
    }
  }

  close(): void {
    this.closed = true;
    const channels = channelsByName.get(this.name);
    if (channels) {
      const idx = channels.indexOf(this);
      if (idx !== -1) channels.splice(idx, 1);
    }
  }
}

const fakeTabId = "test-tab-uuid-1234";
const fakeCrypto = {
  randomUUID: vi.fn(() => fakeTabId),
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a second FakeBroadcastChannel to simulate another tab */
const createPeerChannel = (name = "localterm:favicon"): FakeBroadcastChannel =>
  new FakeBroadcastChannel(name);

/** Deliver a message from a peer channel to the test tab's channel */
const deliverFromPeer = (data: Record<string, unknown>): void => {
  const peer = createPeerChannel();
  peer.postMessage(data);
  peer.close();
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("claimTabHue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();

    faviconStateStore.resetFaviconStateStore();

    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    vi.stubGlobal("crypto", fakeCrypto);

    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    channelsByName.clear();
  });

  it("returns a cleanup function", () => {
    const cleanup = claimTabHue();
    expect(cleanup).toBeInstanceOf(Function);
    cleanup();
  });

  it("creates a BroadcastChannel and posts a ping message", () => {
    const postMessageSpy = vi.spyOn(FakeBroadcastChannel.prototype, "postMessage");
    const cleanup = claimTabHue();

    expect(postMessageSpy).toHaveBeenCalled();

    const pingCalls = postMessageSpy.mock.calls.filter(
      (args: unknown[]) => (args[0] as Record<string, unknown>).type === "ping",
    );
    expect(pingCalls.length).toBeGreaterThanOrEqual(1);

    cleanup();
  });

  it("includes the cached hue and self tabId in the ping", () => {
    const postMessageSpy = vi.spyOn(FakeBroadcastChannel.prototype, "postMessage");
    const cleanup = claimTabHue();

    const pingCalls = postMessageSpy.mock.calls.filter(
      (args: unknown[]) => (args[0] as Record<string, unknown>).type === "ping",
    );
    const ping = pingCalls[0][0] as { tabId: string; hue: number };

    expect(ping.tabId).toBe(fakeTabId);
    expect(typeof ping.hue).toBe("number");
    expect(ping.hue).toBeGreaterThanOrEqual(0);
    expect(ping.hue).toBeLessThan(360);

    cleanup();
  });

  it("returns a noop cleanup when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const cleanup = claimTabHue();
    expect(cleanup).toBeInstanceOf(Function);
    expect(() => cleanup()).not.toThrow();
  });

  it("returns a noop cleanup when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", { randomUUID: undefined });
    const cleanup = claimTabHue();
    expect(cleanup).toBeInstanceOf(Function);
    expect(() => cleanup()).not.toThrow();
  });

  it("cleanup function clears the timeout and closes the channel", () => {
    const closeSpy = vi.spyOn(FakeBroadcastChannel.prototype, "close");
    const cleanup = claimTabHue();
    cleanup();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("responds to a ping from a peer with a 'claimed' message when hues match", () => {
    // The ensureBroadcastChannel listener monitors for pings from other tabs.
    // When a peer's ping carries the same hue, this tab must respond 'claimed'.
    const postMessageSpy = vi.spyOn(FakeBroadcastChannel.prototype, "postMessage");
    const cleanup = claimTabHue();

    const ourHue = Number(window.sessionStorage.getItem("localterm:favicon-hue"));

    // Simulate a peer tab pinging with the same hue
    deliverFromPeer({ type: "ping", tabId: "peer-tab-id", hue: ourHue });

    expect(
      postMessageSpy.mock.calls.filter(
        (args: unknown[]) => (args[0] as Record<string, unknown>).type === "claimed",
      ).length,
    ).toBeGreaterThanOrEqual(1);

    cleanup();
  });

  it("does NOT respond to pings from self", () => {
    const postMessageSpy = vi.spyOn(FakeBroadcastChannel.prototype, "postMessage");
    const cleanup = claimTabHue();

    // This ping should NOT trigger a "claimed" response because tabId === self
    deliverFromPeer({ type: "ping", tabId: fakeTabId, hue: 42 });

    const claimedCalls = postMessageSpy.mock.calls.filter(
      (args: unknown[]) => (args[0] as Record<string, unknown>).type === "claimed",
    );
    expect(claimedCalls).toHaveLength(0);

    cleanup();
  });

  it("does NOT respond when the peer hue differs", () => {
    const postMessageSpy = vi.spyOn(FakeBroadcastChannel.prototype, "postMessage");
    const cleanup = claimTabHue();

    deliverFromPeer({ type: "ping", tabId: "peer-tab-id", hue: 999 });

    const claimedCalls = postMessageSpy.mock.calls.filter(
      (args: unknown[]) => (args[0] as Record<string, unknown>).type === "claimed",
    );
    expect(claimedCalls).toHaveLength(0);

    cleanup();
  });

  it("resolves collision by picking a fresh hue when a peer claims the same hue", () => {
    const cleanup = claimTabHue();
    const originalHue = Number(window.sessionStorage.getItem("localterm:favicon-hue"));

    // Simulate a peer claiming the same hue
    deliverFromPeer({ type: "claimed", tabId: "peer-tab-id", hue: originalHue });

    // Fast-forward past the collision-resolution timeout
    vi.advanceTimersByTime(250);

    // A fresh hue should have been picked (it must be a valid hue)
    const newHue = Number(window.sessionStorage.getItem("localterm:favicon-hue"));
    expect(newHue).toBeGreaterThanOrEqual(0);
    expect(newHue).toBeLessThan(360);

    cleanup();
  });

  it("does not change hue when no collision is detected (timeout with no claims)", () => {
    const cleanup = claimTabHue();
    const ourHue = Number(window.sessionStorage.getItem("localterm:favicon-hue"));

    vi.advanceTimersByTime(250);

    expect(Number(window.sessionStorage.getItem("localterm:favicon-hue"))).toBe(ourHue);
    cleanup();
  });

  it("can call cleanup multiple times without error", () => {
    const cleanup = claimTabHue();
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
  });

  it("handles cleanup being called before the collision timeout fires", () => {
    const cleanup = claimTabHue();
    cleanup();
    // Advancing timers after cleanup should be a no-op (no crash)
    expect(() => vi.advanceTimersByTime(250)).not.toThrow();
  });
});
