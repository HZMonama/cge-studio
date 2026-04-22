"use client";

import type { ElementType } from "react";
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export interface AppHeaderSection {
  id: string;
  label: string;
  Icon: ElementType;
}

export type SyncStatus = "synced" | "fallback" | "offline";

function SyncIndicator({
  status,
  pending,
  onRefresh,
}: {
  status: SyncStatus;
  pending: boolean;
  onRefresh: () => void;
}) {
  const config = {
    synced: {
      Icon: CheckCircleIcon,
      className:
        "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400",
      label: "Live registry",
    },
    fallback: {
      Icon: WarningCircleIcon,
      className:
        "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-400",
      label: "Fallback registry",
    },
    offline: {
      Icon: XCircleIcon,
      className:
        "border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-400",
      label: "Runner offline",
    },
  }[status];

  return (
    <div className="flex h-full items-center pr-3">
      <button
        type="button"
        onClick={onRefresh}
        disabled={pending}
        title="Refresh runner status and test the live registry connection"
        aria-label="Refresh runner status and test the live registry connection"
        className={cn(
          "flex h-8 items-center gap-2 border px-3 text-[11px] font-medium tracking-[0.08em] uppercase transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-80",
          config.className,
        )}
      >
        {pending ? (
          <ArrowClockwiseIcon
            className="size-3.5 shrink-0 animate-spin"
            weight="bold"
          />
        ) : (
          <config.Icon className="size-3.5 shrink-0" weight="fill" />
        )}
        <span>{pending ? "Checking connection" : config.label}</span>
      </button>
    </div>
  );
}

export function AppShellHeader({
  activeSection,
  onSelectSection,
  sections,
  syncStatus,
  syncPending,
  onRefreshSync,
}: {
  activeSection: string;
  onSelectSection: (section: string) => void;
  sections: AppHeaderSection[];
  syncStatus: SyncStatus;
  syncPending: boolean;
  onRefreshSync: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-(--row-h) shrink-0 items-end border-b border-border/70 bg-background/88 backdrop-blur">
      <div className="relative min-w-0 flex-1 self-stretch">
        <div className="flex h-full items-end gap-1 overflow-x-auto overflow-y-hidden px-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              className={cn(
                "group relative flex h-[calc(var(--row-h)-6px)] min-w-0 max-w-44 shrink-0 items-center gap-1.5 border border-b-0 px-3 text-xs transition-colors",
                section.id === activeSection
                  ? "z-10 -mb-px border-border/70 bg-(--editor-bg) text-foreground shadow-[0_2px_0_0_var(--editor-bg)]"
                  : "border-transparent bg-background/28 text-muted-foreground hover:border-border/45 hover:bg-background/52 hover:text-foreground",
              )}
            >
              <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                <section.Icon
                  className={cn(
                    "size-3.5 transition-opacity",
                    section.id === activeSection
                      ? "opacity-0"
                      : "group-hover:opacity-0",
                  )}
                  weight="regular"
                />
                <section.Icon
                  className={cn(
                    "absolute inset-0 size-3.5 transition-opacity",
                    section.id === activeSection
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                  weight="fill"
                />
              </span>
              <span className="truncate">{section.label}</span>
            </button>
          ))}
        </div>
      </div>
      <SyncIndicator
        status={syncStatus}
        pending={syncPending}
        onRefresh={onRefreshSync}
      />
    </header>
  );
}
