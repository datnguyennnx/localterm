export type ClientToServerMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };
