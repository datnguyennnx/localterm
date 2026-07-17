import { useEffect, type RefObject } from "react";

export const useTimerCleanup = (
  retryFeedbackTimerRef: RefObject<number | null>,
  copyFeedbackTimerRef: RefObject<number | null>,
): void => {
  useEffect(() => {
    return () => {
      if (retryFeedbackTimerRef.current !== null) {
        window.clearTimeout(retryFeedbackTimerRef.current);
        retryFeedbackTimerRef.current = null;
      }
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = null;
      }
    };
  }, [retryFeedbackTimerRef, copyFeedbackTimerRef]);
};
