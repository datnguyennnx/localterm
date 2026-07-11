import { describe, expect, it } from "vite-plus/test";
import { WS_HEARTBEAT_GRACE_MS, WS_HEARTBEAT_TIMEOUT_MS } from "../../src/constants.js";
import { getHeartbeatAction } from "../../src/utils/get-heartbeat-action.js";

describe("getHeartbeatAction", () => {
  it("pings normally while the most recent pong is fresh", () => {
    expect(getHeartbeatAction(WS_HEARTBEAT_TIMEOUT_MS, 0, 0)).toBe("ping");
  });

  it("starts a grace ping after the heartbeat timeout", () => {
    expect(getHeartbeatAction(WS_HEARTBEAT_TIMEOUT_MS + 1, 0, 0)).toBe("grace-ping");
  });

  it("waits for a pong throughout the grace period", () => {
    const pendingPingAt = WS_HEARTBEAT_TIMEOUT_MS + 1;
    expect(getHeartbeatAction(pendingPingAt + WS_HEARTBEAT_GRACE_MS - 1, 0, pendingPingAt)).toBe(
      "wait",
    );
  });

  it("terminates only after the grace period expires", () => {
    const pendingPingAt = WS_HEARTBEAT_TIMEOUT_MS + 1;
    expect(getHeartbeatAction(pendingPingAt + WS_HEARTBEAT_GRACE_MS, 0, pendingPingAt)).toBe(
      "terminate",
    );
  });

  it("returns to normal pings after a fresh pong clears grace state", () => {
    const now = WS_HEARTBEAT_TIMEOUT_MS + WS_HEARTBEAT_GRACE_MS;
    expect(getHeartbeatAction(now, now, 0)).toBe("ping");
  });
});
