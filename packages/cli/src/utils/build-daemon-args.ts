export interface DaemonStartArgsInput {
  port: number;
  host: string;
  open: boolean;
  yolo?: boolean;
  maxSessions?: number;
}

export const buildDaemonStartArgs = (input: DaemonStartArgsInput): string[] => {
  const args = ["start", "--port", String(input.port), "--host", input.host];
  if (!input.open) args.push("--no-open");
  if (input.yolo) args.push("--yolo");
  if (input.maxSessions !== undefined) {
    args.push("--max-sessions", String(input.maxSessions));
  }
  return args;
};
