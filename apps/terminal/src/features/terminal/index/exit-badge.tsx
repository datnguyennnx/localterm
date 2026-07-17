import type { ExitInfo } from "../types";

interface TerminalExitBadgeProps {
  exitInfo: ExitInfo | null;
}

export const TerminalExitBadge = ({ exitInfo }: TerminalExitBadgeProps) => {
  if (!exitInfo) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className="absolute top-2 left-3 z-10 inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400"
    >
      {exitInfo.reason === "shell-exited"
        ? exitInfo.exitCode === null
          ? "exited"
          : `exited · code ${exitInfo.exitCode}`
        : `disconnected · code ${exitInfo.closeCode}`}
    </span>
  );
};
