import { useMemo } from "react";
import { detectIsAppleWebKit } from "@/platform/detect-is-apple-webkit";
import { detectIsMacPlatform } from "@/platform/detect-is-mac-platform";
import { isCoarsePointer } from "@/platform/is-coarse-pointer";

export const usePlatform = () => {
  const isMac = useMemo(detectIsMacPlatform, []);
  const isTouchDevice = useMemo(isCoarsePointer, []);
  const isAppleWebKit = useMemo(detectIsAppleWebKit, []);
  return { isMac, isTouchDevice, isAppleWebKit };
};
