export const registerServiceWorker = (isDevelopment = import.meta.env.DEV): void => {
  if (isDevelopment || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
    console.warn("[localterm] service worker registration failed", error);
  });
};
