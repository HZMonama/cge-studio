"use client";

import { ChartBarIcon, XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { type RunnerMetricSnapshotSummary } from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";

export function MetricSnapshotsPanel({
  onSelectSnapshot,
  selectedSnapshotId,
  snapshots,
}: {
  onSelectSnapshot: (snapshotId: string) => void;
  selectedSnapshotId: string | null;
  snapshots: RunnerMetricSnapshotSummary[];
}) {
  const { closeMetricHistory, metricHistoryOpen } = usePluginPanel();

  return (
    <div
      className={cn(
        "h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
        metricHistoryOpen ? "w-[var(--app-sidebar-w)] opacity-100" : "w-0 opacity-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col overflow-hidden border-l bg-background text-foreground">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-center justify-between border-b px-4">
          <div className="flex min-w-0 flex-col gap-0">
            <span className="truncate text-sm font-medium">Metric History</span>
            <span className="text-xs text-foreground/50">snapshots</span>
          </div>
          <button
            onClick={closeMetricHistory}
            className="flex size-6 items-center justify-center self-start pt-3 text-foreground/50 transition-colors hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          {snapshots.length > 0 ? (
            <ul>
              {snapshots.map((snapshot) => (
                <li key={snapshot.snapshot_id} className="border-b last:border-0">
                  <button
                    onClick={() => onSelectSnapshot(snapshot.snapshot_id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:text-foreground",
                      selectedSnapshotId === snapshot.snapshot_id
                        ? "text-foreground"
                        : "text-foreground/60",
                    )}
                  >
                    <ChartBarIcon className="mt-0.5 size-4 shrink-0 text-foreground/45" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {new Date(snapshot.recorded_at).toLocaleString()}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-foreground/40">
                        {snapshot.metric_count} metrics
                      </p>
                      <p className="mt-2 truncate font-mono text-[10px] text-foreground/35">
                        {snapshot.snapshot_id}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-44">
                <p className="text-sm font-medium text-foreground">No snapshots</p>
                <p className="mt-2 text-xs leading-5 text-foreground/55">
                  Metric snapshots will appear after workspace metrics are materialized.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
