import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TAB_MIN_WIDTH_PX } from "@/lib/constants";
import { useSessions } from "@/lib/use-sessions";
import { cn } from "@/lib/utils";

interface TabBarProps {
  onNew: () => void;
}

export const TabBar = ({ onNew }: TabBarProps) => {
  const sessions = useSessions((state) => state.sessions);
  const activeId = useSessions((state) => state.activeId);
  const setActive = useSessions((state) => state.setActive);
  const remove = useSessions((state) => state.remove);

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-[#0a0a0a]">
      <div
        role="tablist"
        aria-label="terminal sessions"
        className="flex flex-1 items-stretch overflow-x-auto"
      >
        {sessions.map((session) => {
          const isActive = session.id === activeId;
          const label = session.title || "shell";
          return (
            <div
              key={session.id}
              className={cn(
                "group relative flex min-w-0 flex-1 items-center border-r border-border/40 transition-colors",
                isActive
                  ? "bg-[#101010] text-foreground"
                  : "bg-[#0a0a0a] text-muted-foreground hover:bg-[#0e0e0e] hover:text-foreground",
                session.exited && "italic opacity-60",
              )}
              style={{ minWidth: TAB_MIN_WIDTH_PX }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  void remove(session.id);
                }
              }}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px bg-foreground/40"
                />
              ) : null}
              <button
                type="button"
                role="tab"
                id={`tab-${session.id}`}
                aria-selected={isActive}
                aria-controls={`terminal-panel-${session.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(session.id)}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isActive ? "bg-foreground/70" : "bg-current opacity-50",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void remove(session.id);
                }}
                aria-label={`close ${label}`}
                className="mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-foreground/10 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        className="m-1 shrink-0"
        onClick={onNew}
        aria-label="new tab"
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
};
