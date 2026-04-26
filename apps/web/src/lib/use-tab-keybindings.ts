import { useEffect } from "react";

interface KeybindingHandlers {
  onNewTab: () => void;
  onCloseTab: () => void;
  onNextTab: () => void;
  onPrevTab: () => void;
  onJumpTo: (index: number) => void;
}

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return navigatorWithStandalone.standalone === true;
};

export const useTabKeybindings = (handlers: KeybindingHandlers): void => {
  useEffect(() => {
    const standalone = isStandalone();
    const handler = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      const key = event.key.toLowerCase();

      const wantsNew = (event.altKey && key === "t") || (standalone && key === "t");
      const wantsClose = (event.altKey && key === "w") || (standalone && key === "w");
      const wantsNext = key === "]" || (event.shiftKey && key === "}");
      const wantsPrev = key === "[" || (event.shiftKey && key === "{");
      const isDigit = /^[1-9]$/.test(event.key);

      if (wantsNew) {
        event.preventDefault();
        handlers.onNewTab();
        return;
      }
      if (wantsClose) {
        event.preventDefault();
        handlers.onCloseTab();
        return;
      }
      if (wantsNext) {
        event.preventDefault();
        handlers.onNextTab();
        return;
      }
      if (wantsPrev) {
        event.preventDefault();
        handlers.onPrevTab();
        return;
      }
      if (isDigit && (event.altKey || standalone)) {
        event.preventDefault();
        handlers.onJumpTo(Number.parseInt(event.key, 10) - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
};
