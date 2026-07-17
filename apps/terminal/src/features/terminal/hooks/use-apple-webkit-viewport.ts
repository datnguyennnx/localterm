import { useEffect, type RefObject } from "react";
import { syncAppleWebKitViewport } from "@/platform/sync-apple-webkit-viewport";

export const useAppleWebKitViewport = (
  rootRef: RefObject<HTMLDivElement | null>,
  isTouchDevice: boolean,
  isAppleWebKit: boolean,
): void => {
  useEffect(() => {
    if (!isTouchDevice || !isAppleWebKit) return;
    const root = rootRef.current;
    const visualViewport = window.visualViewport;
    if (!root || !visualViewport) return;
    return syncAppleWebKitViewport(root, visualViewport);
  }, [isTouchDevice, isAppleWebKit, rootRef]);
};
