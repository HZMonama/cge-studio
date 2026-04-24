"use client";

import { useState, type ElementType } from "react";
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  CircleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type ClaudeCodeStatus,
  type RunnerHealthSnapshot,
} from "@/lib/runner";

export interface AppHeaderSection {
  id: string;
  label: string;
  Icon: ElementType;
  disabled?: boolean;
}

export type SyncStatus = "synced" | "fallback" | "offline";

type SignalTone = "ok" | "warn" | "error" | "unknown";

function signalDot(tone: SignalTone) {
  if (tone === "ok") return <CheckCircleIcon className="size-3.5 text-emerald-400" weight="fill" />;
  if (tone === "warn") return <WarningCircleIcon className="size-3.5 text-amber-400" weight="fill" />;
  if (tone === "error") return <XCircleIcon className="size-3.5 text-rose-400" weight="fill" />;
  return <CircleIcon className="size-3.5 text-muted-foreground/40" weight="fill" />;
}

function overallTone(tones: SignalTone[]): SignalTone {
  if (tones.includes("error")) return "error";
  if (tones.includes("warn")) return "warn";
  if (tones.every((t) => t === "ok")) return "ok";
  return "unknown";
}

function SyncIndicator({
  claudeCodeStatus,
  health,
  pending,
  status,
  onRefresh,
}: {
  claudeCodeStatus: ClaudeCodeStatus | null;
  health: RunnerHealthSnapshot | null;
  pending: boolean;
  status: SyncStatus;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);

  const registryTone: SignalTone =
    status === "synced" ? "ok" : status === "fallback" ? "warn" : "error";
  const runnerTone: SignalTone =
    health === null ? "unknown" : health.ok ? "ok" : "error";
  const authSatisfied =
    claudeCodeStatus !== null &&
    claudeCodeStatus.installed &&
    (claudeCodeStatus.apiKeyConfigured || claudeCodeStatus.subscriptionLoginConfigured);

  const claudeTone: SignalTone =
    claudeCodeStatus === null
      ? "unknown"
      : !claudeCodeStatus.installed
        ? "error"
        : authSatisfied
          ? "ok"
          : "warn";

  const buttonTone = overallTone([registryTone, runnerTone, claudeTone]);

  const registryLabel =
    status === "synced" ? "Live registry" : status === "fallback" ? "Fallback registry" : "Registry offline";
  const runnerLabel =
    health === null ? "Unknown" : health.ok ? "Runner connected" : "Runner offline";

  const claudeAuthLabel = claudeCodeStatus === null
    ? "Unknown"
    : !claudeCodeStatus.installed
      ? "Not installed"
      : claudeCodeStatus.subscriptionLoginConfigured
        ? `Subscription · ${claudeCodeStatus.model ?? "Default model"}`
        : claudeCodeStatus.apiKeyConfigured
          ? `API key · ${claudeCodeStatus.model ?? "Default model"}`
          : "No auth configured";
  const claudeLabel = claudeCodeStatus?.version
    ? `${claudeCodeStatus.version} · ${claudeAuthLabel}`
    : claudeAuthLabel;

  return (
    <div className="flex h-full items-center justify-center px-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex size-8 items-center justify-center transition-colors hover:bg-accent",
            pending && "opacity-60",
          )}
          aria-label="System health"
          title="System health"
        >
          {pending ? (
            <ArrowClockwiseIcon className="size-3.5 animate-spin text-muted-foreground" weight="bold" />
          ) : buttonTone === "ok" ? (
            <CheckCircleIcon className="size-3.5 text-emerald-400" weight="fill" />
          ) : buttonTone === "warn" ? (
            <WarningCircleIcon className="size-3.5 text-amber-400" weight="fill" />
          ) : buttonTone === "error" ? (
            <XCircleIcon className="size-3.5 text-rose-400" weight="fill" />
          ) : (
            <CircleIcon className="size-3.5 text-muted-foreground/40" weight="fill" />
          )}
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverPositioner side="bottom" align="end" sideOffset={4}>
            <PopoverContent className="w-64 p-0">
              <div className="border-b px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  System health
                </p>
              </div>
              <ul className="divide-y">
                <li className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-foreground">Registry</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{registryLabel}</span>
                    {signalDot(registryTone)}
                  </div>
                </li>
                <li className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs text-foreground">Runner</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{runnerLabel}</span>
                    {signalDot(runnerTone)}
                  </div>
                </li>
                <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="shrink-0 text-xs text-foreground">Agent</span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-right text-[10px] text-muted-foreground">{claudeLabel}</span>
                    {signalDot(claudeTone)}
                  </div>
                </li>
              </ul>
              <div className="border-t px-3 py-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    onRefresh();
                  }}
                  disabled={pending ? true : false}
                  className="flex w-full items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <ArrowClockwiseIcon className="size-3" />
                  Refresh
                </button>
              </div>
            </PopoverContent>
          </PopoverPositioner>
        </PopoverPortal>
      </Popover>
    </div>
  );
}

export function AppShellHeader({
  activeSection,
  claudeCodeStatus,
  health,
  onSelectSection,
  sections,
  syncStatus,
  syncPending,
  onRefreshSync,
}: {
  activeSection: string;
  claudeCodeStatus: ClaudeCodeStatus | null;
  health: RunnerHealthSnapshot | null;
  onSelectSection: (section: string) => void;
  sections: AppHeaderSection[];
  syncStatus: SyncStatus;
  syncPending: boolean;
  onRefreshSync: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-(--row-h) min-h-(--row-h) max-h-(--row-h) shrink-0 items-center overflow-hidden border-b border-border/70 bg-background/88 backdrop-blur">
      <div className="relative min-w-0 flex-1 self-stretch">
        <div className="flex h-full min-h-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => !section.disabled && onSelectSection(section.id)}
              disabled={section.disabled}
              title={section.disabled ? "Coming soon" : undefined}
              className={cn(
                "group relative flex h-[4vh] min-w-0 max-w-44 shrink-0 items-center gap-1.5 rounded-none border px-3 text-xs font-medium leading-none transition-colors",
                section.disabled
                  ? "cursor-not-allowed border-transparent bg-transparent text-muted-foreground/40"
                  : section.id === activeSection
                    ? "border-border/70 bg-border/70 text-foreground shadow-sm"
                    : "border-transparent bg-background/20 text-muted-foreground hover:border-border/45 hover:bg-background/52 hover:text-foreground",
              )}
            >
              <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                <section.Icon
                  className={cn(
                    "size-3.5 transition-opacity",
                    !section.disabled && section.id === activeSection
                      ? "opacity-0"
                      : section.disabled
                        ? "opacity-100"
                        : "group-hover:opacity-0",
                  )}
                  weight="regular"
                />
                {!section.disabled && (
                  <section.Icon
                    className={cn(
                      "absolute inset-0 size-3.5 transition-opacity",
                      section.id === activeSection
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                    weight="fill"
                  />
                )}
              </span>
              <span className="truncate leading-none">{section.label}</span>
            </button>
          ))}
        </div>
      </div>
      <SyncIndicator
        claudeCodeStatus={claudeCodeStatus}
        health={health}
        status={syncStatus}
        pending={syncPending}
        onRefresh={onRefreshSync}
      />
    </header>
  );
}
