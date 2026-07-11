import { WS_HEARTBEAT_GRACE_MS, WS_HEARTBEAT_TIMEOUT_MS } from "../constants.js";

type HeartbeatAction = "ping" | "grace-ping" | "wait" | "terminate";

export const getHeartbeatAction = (
  nowMs: number,
  lastPongAtMs: number,
  pendingPingAtMs: number,
): HeartbeatAction => {
  if (nowMs - lastPongAtMs <= WS_HEARTBEAT_TIMEOUT_MS) return "ping";
  if (pendingPingAtMs === 0) return "grace-ping";
  if (nowMs - pendingPingAtMs < WS_HEARTBEAT_GRACE_MS) return "wait";
  return "terminate";
};
