"use client"

import { ClockCounterClockwiseIcon, XIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { type RunnerRun } from "@/lib/runner"
import { usePluginPanel } from "@/stores/plugin-panel-store"

function statusTone(status: RunnerRun["status"]) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-400"
  if (status === "failed") return "bg-rose-500/10 text-rose-400"
  if (status === "running") return "bg-sky-500/10 text-sky-400"
  return "bg-muted text-muted-foreground"
}

export function RunnerHistoryPanel({
  onSelectArtifact,
  runs,
}: {
  onSelectArtifact: (artifactId: string) => void
  runs: RunnerRun[]
}) {
  const { closeHistory, historyOpen } = usePluginPanel()

  return (
    <div className={cn(
      "shrink-0 overflow-hidden transition-[width] duration-200",
      historyOpen ? "w-[var(--app-sidebar-w)]" : "w-0"
    )}>
      <div className="flex h-full w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col border-l bg-sidebar text-sidebar-foreground">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-start justify-between border-b pl-4 pr-2 pt-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-medium">Runner History</span>
            <span className="text-xs text-sidebar-foreground/50">recent runs</span>
          </div>
          <button
            onClick={closeHistory}
            className="mt-0.5 flex size-6 items-center justify-center text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
          {runs.length > 0 ? (
            <ul>
              {runs.map((run) => (
                <li key={run.id} className="border-b last:border-0">
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-sidebar-foreground">
                          {run.commandPath ?? run.id}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/40">
                          {new Date(run.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={cn("shrink-0 px-1.5 py-0.5 text-[10px] font-medium capitalize", statusTone(run.status))}>
                        {run.status}
                      </span>
                    </div>

                    {run.prompt && (
                      <p className="mt-2 line-clamp-2 text-xs text-sidebar-foreground/60">
                        {run.prompt}
                      </p>
                    )}

                    {run.artifacts.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {run.artifacts.map((artifact) => (
                          <button
                            key={artifact.id}
                            onClick={() => onSelectArtifact(artifact.id)}
                            className="flex w-full items-center gap-2 border border-sidebar-border px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          >
                            <ClockCounterClockwiseIcon className="size-3.5 shrink-0 text-sidebar-foreground/50" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{artifact.title}</p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/45">
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
                <p className="text-sm font-medium text-sidebar-foreground">No runs yet</p>
                <p className="mt-2 text-xs leading-5 text-sidebar-foreground/55">
                  Executed commands will appear here with linked artifacts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
