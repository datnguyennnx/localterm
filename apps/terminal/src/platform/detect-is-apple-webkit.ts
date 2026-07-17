export const detectIsAppleWebKit = (): boolean =>
  typeof navigator !== "undefined" && navigator.vendor === "Apple Computer, Inc.";
