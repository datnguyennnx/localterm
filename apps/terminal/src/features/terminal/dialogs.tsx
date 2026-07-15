import { Check, Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { RESTART_COMMAND } from "@/lib/constants";
import type { ExitInfo } from "./types";

interface DialogsProps {
  isModalOpen: boolean;
  exitInfo: ExitInfo | null;
  isRetryingConnection: boolean;
  hasCopiedRestartCommand: boolean;
  newTabUrl: string;
  onReconnect: () => void;
  onCopyRestartCommand: () => void;
}

export const TerminalDialogs = ({
  isModalOpen,
  exitInfo,
  isRetryingConnection,
  hasCopiedRestartCommand,
  newTabUrl,
  onReconnect,
  onCopyRestartCommand,
}: DialogsProps) => (
  <AlertDialog open={isModalOpen}>
    <AlertDialogContent>
      {exitInfo !== null ? (
        exitInfo.reason === "shell-exited" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Shell ended</AlertDialogTitle>
              <AlertDialogDescription>
                {exitInfo.exitCode === null || exitInfo.exitCode === 0
                  ? "Open a new shell to keep going, or close this tab."
                  : `Exit code ${exitInfo.exitCode}. Open a new shell to keep going.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => window.open(newTabUrl, "_blank", "noopener,noreferrer")}
              >
                New shell
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Spinner aria-hidden="true" role="presentation" />
                Connection lost
              </AlertDialogTitle>
              <AlertDialogDescription>
                The browser lost its connection to the localterm daemon (close code{" "}
                {exitInfo.closeCode}
                {exitInfo.closeReason ? ` · ${exitInfo.closeReason}` : ""}). Reconnecting spawns a
                fresh shell. The previous one can't be reattached.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={onReconnect} disabled={isRetryingConnection}>
                {isRetryingConnection ? <Spinner data-icon="inline-start" /> : null}
                Reconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )
      ) : (
        <>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Spinner aria-hidden="true" role="presentation" />
              Lost connection
            </AlertDialogTitle>
            <AlertDialogDescription>
              The localterm server isn't responding. Start it again from your terminal, then retry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <InputGroup>
            <InputGroupInput
              readOnly
              value={RESTART_COMMAND}
              aria-label="restart command"
              className="font-mono"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={onCopyRestartCommand}
                aria-label={hasCopiedRestartCommand ? "Copied" : "Copy restart command"}
              >
                {hasCopiedRestartCommand ? <Check /> : <Copy />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onReconnect} disabled={isRetryingConnection}>
              {isRetryingConnection ? <Spinner data-icon="inline-start" /> : null}
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      )}
    </AlertDialogContent>
  </AlertDialog>
);
