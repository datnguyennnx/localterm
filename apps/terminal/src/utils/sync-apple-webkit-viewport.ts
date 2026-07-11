export const syncAppleWebKitViewport = (
  root: HTMLElement,
  visualViewport: VisualViewport,
): (() => void) => {
  let pendingFrame: number | null = null;
  const applyViewport = () => {
    pendingFrame = null;
    root.style.height = `${visualViewport.height}px`;
    root.style.transform = visualViewport.offsetTop
      ? `translateY(${visualViewport.offsetTop}px)`
      : "";
  };
  const scheduleViewport = () => {
    if (pendingFrame !== null) return;
    pendingFrame = window.requestAnimationFrame(applyViewport);
  };
  scheduleViewport();
  visualViewport.addEventListener("resize", scheduleViewport);
  visualViewport.addEventListener("scroll", scheduleViewport);
  return () => {
    if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
    visualViewport.removeEventListener("resize", scheduleViewport);
    visualViewport.removeEventListener("scroll", scheduleViewport);
    root.style.height = "";
    root.style.transform = "";
  };
};
