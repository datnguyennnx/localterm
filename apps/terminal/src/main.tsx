if (import.meta.env.DEV) {
  import("react-grab");
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOLTIP_DELAY_MS } from "@/lib/constants";
import { applyTabFavicon } from "./utils/apply-tab-favicon";
import { loadGoogleFontsStylesheet } from "./utils/load-google-fonts-stylesheet";
import { registerServiceWorker } from "./utils/register-service-worker";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/600.css";
import "./index.css";

applyTabFavicon();
loadGoogleFontsStylesheet();
registerServiceWorker();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement, {
  onCaughtError(error, info) {
    console.error("[localterm] React caught error:", error, info);
  },
  onUncaughtError(error, errorInfo) {
    console.error("[localterm] React uncaught error:", error, errorInfo);
  },
  onRecoverableError(error, errorInfo) {
    console.error("[localterm] React recoverable error:", error, errorInfo);
  },
}).render(
  <StrictMode>
    <TooltipProvider delay={TOOLTIP_DELAY_MS}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
