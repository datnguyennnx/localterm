import { useEffect } from "react";

export const useReconnectPolling = (
  isConnectionLost: boolean,
  triggerManualReconnect: () => void,
  pollIntervalMs: number,
): void => {
  useEffect(() => {
    if (!isConnectionLost) return;
    const intervalId = window.setInterval(() => {
      triggerManualReconnect();
    }, pollIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [isConnectionLost, triggerManualReconnect, pollIntervalMs]);
};
