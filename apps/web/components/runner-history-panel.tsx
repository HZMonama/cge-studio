"use client";

import { ClockCounterClockwiseIcon, XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { type RunnerRun } from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";
import { useClickOutside } from "@/hooks/use-click-outside";

function statusTone(status: RunnerRun["status"]) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-400";
  if (status === "canceled") return "bg-slate-500/10 text-slate-400";
  if (status === "failed") return "bg-rose-500/10 text-rose-400";
  if (status === "running") return "bg-sky-500/10 text-sky-400";
  if (status === "pending") return "bg-amber-500/10 text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function RunnerHistoryPanel({
  onSelectRun,
  onSelectArtifact,
  runs,
  selectedRunId,
}: {
  onSelectRun: (runId: string) => void;
  onSelectArtifact: (artifactId: string) => void;
  runs: RunnerRun[];
  selectedRunId: string | null;
}) {
  const { closeHistory, historyOpen } = usePluginPanel();
  const panelRef = useClickOutside<HTMLDivElement>(closeHistory, historyOpen);

  return (
    <div
      ref={panelRef}
      className={cn(
        "h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
        historyOpen ? "w-[var(--app-sidebar-w)] opacity-100" : "w-0 opacity-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col border-l bg-background text-foreground overflow-hidden">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-center justify-between border-b px-4">
          <div className="flex min-w-0 flex-col gap-0">
            <span className="truncate text-sm font-medium">Runner History</span>
            <span className="text-xs text-foreground/50">
              recent runs
            </span>
          </div>
          <button
            onClick={closeHistory}
            className="self-start pt-3 flex size-6 items-center justify-center text-foreground/50 transition-colors hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          {runs.length > 0 ? (
            <ul>
              {runs.map((run) => (
                <li key={run.id} className="border-b last:border-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectRun(run.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectRun(run.id);
                      }
                    }}
                    className={cn(
                      "group/run-history cursor-pointer px-4 py-3 transition-colors hover:bg-accent/35",
                      selectedRunId === run.id ? "bg-accent/20" : null,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "min-w-0 flex-1 text-left transition-colors",
                          selectedRunId === run.id
                            ? "text-foreground"
                            : "text-foreground/60 group-hover/run-history:text-foreground",
                        )}
                      >
                        <p className="truncate text-xs font-medium">
                          {run.commandPath ?? run.id}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-foreground/40">
                          {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 px-1.5 py-0.5 text-[10px] font-medium capitalize",
                          statusTone(run.status),
                        )}
                      >
                        {run.status}
                      </span>
                    </div>

                    {run.prompt && (
                      <p className="mt-2 line-clamp-2 text-xs text-foreground/60">
                        {run.prompt}
                      </p>
                    )}

                    {run.artifacts && run.artifacts.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {run.artifacts.map((artifact) => (
                          <button
                            key={artifact.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectArtifact(artifact.id);
                            }}
                            className="sidebar-fade-item flex w-full items-center gap-2 border border-border/70 px-2.5 py-2 text-left text-foreground/60 transition-colors hover:text-sidebar-accent-foreground"
                          >
                            <ClockCounterClockwiseIcon className="size-3.5 shrink-0 text-foreground/50" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {artifact.title}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-foreground/45">
                                {artifact.format}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-44">
                <p className="text-sm font-medium text-foreground">
                  No runs yet
                </p>
                <p className="mt-2 text-xs leading-5 text-foreground/55">
                  Executed commands will appear here with linked artifacts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
