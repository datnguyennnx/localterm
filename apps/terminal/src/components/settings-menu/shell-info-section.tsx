import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { TerminalSessionInfo } from "@/features/terminal/session/terminal-session-info";
import { cn } from "@/lib/utils";

const SECTION_LABEL_CLASSES =
  "text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase";

const ROW_LABEL_CLASSES = "text-xs font-normal text-muted-foreground";

interface SessionInfoRowProps {
  label: string;
  value: string;
  title?: string;
  valueClassName?: string;
}

const SessionInfoRow = ({ label, value, title, valueClassName }: SessionInfoRowProps) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className={ROW_LABEL_CLASSES}>{label}</dt>
    <dd
      title={title ?? value}
      className={cn("min-w-0 truncate text-right text-foreground/90", valueClassName)}
    >
      {value}
    </dd>
  </div>
);

interface ShellInfoSectionProps {
  sessionInfo: TerminalSessionInfo | null;
}

export const ShellInfoSection = ({ sessionInfo }: ShellInfoSectionProps) => {
  if (!sessionInfo) return null;

  return (
    <>
      <Separator className="bg-border/40" />
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group/shell flex w-full items-center justify-between gap-2 rounded-sm py-1 text-left transition-colors outline-none hover:text-foreground/90 focus-visible:text-foreground/90"
            >
              <span className={SECTION_LABEL_CLASSES}>Shell</span>
              <ChevronDown className="size-3 text-muted-foreground/60 transition-transform duration-200 ease-snappy will-change-transform group-aria-expanded/shell:rotate-180" />
            </button>
          }
        />
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-snappy data-closed:h-0">
          <dl className="flex flex-col gap-1 pt-2 text-xs">
            <SessionInfoRow label="Name" value={sessionInfo.shellName} />
            <SessionInfoRow label="Path" value={sessionInfo.shell} title={sessionInfo.shell} />
            <SessionInfoRow
              label="PID"
              value={String(sessionInfo.pid)}
              valueClassName="tabular-nums"
            />
            <SessionInfoRow label="Cwd" value={sessionInfo.cwd} title={sessionInfo.cwd} />
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
};
