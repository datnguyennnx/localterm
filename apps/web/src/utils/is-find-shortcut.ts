export const isFindShortcut = (event: KeyboardEvent, isMac: boolean): boolean => {
  if (event.key !== "f" && event.key !== "F") return false;
  return isMac
    ? event.metaKey && !event.ctrlKey && !event.altKey
    : event.ctrlKey && !event.metaKey && !event.altKey;
};
