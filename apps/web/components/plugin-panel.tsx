"use client";

import { type Command } from "@/lib/plugins";
import { XIcon, Asterisk } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { usePluginPanel } from "@/stores/plugin-panel-store";

const SUPPORT_COLORS: Record<string, string> = {
  ready: "bg-emerald-500/10 text-emerald-400",
  planned: "bg-pink-500/10 text-pink-400",
};

export function PluginPanel({
  onSelectCommand,
}: {
  onSelectCommand?: (pluginId: string, command: Command) => void;
}) {
  const { selectedPlugin, setSelectedPlugin } = usePluginPanel();
  const readyCount =
    selectedPlugin?.commands.filter((command) => command.runnerSupport === "ready")
      .length ?? 0;
  const plannedCount =
    selectedPlugin?.commands.filter(
      (command) => command.runnerSupport === "planned",
    ).length ?? 0;

  return (
    <div
      className={cn(
        "h-svh shrink-0 overflow-hidden transition-[width] duration-200",
        selectedPlugin ? "w-[var(--app-sidebar-w)]" : "w-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col border-l bg-background text-foreground">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-center justify-between border-b px-4">
          <div className="flex min-w-0 flex-col gap-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-medium">
                {selectedPlugin?.label}
              </span>
              {selectedPlugin?.isCustom && (
                <Asterisk className="size-3.5 text-amber-400" weight="bold" />
              )}
            </div>
            {selectedPlugin && (
              <>
                <span className="text-xs text-foreground/50 capitalize">
                  {selectedPlugin.type}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 self-start pt-1">
                  <span
                    className={cn(
                      "inline-flex h-6 items-center px-2 text-[10px] font-medium uppercase tracking-[0.12em]",
                      SUPPORT_COLORS.ready,
                    )}
                  >
                    {readyCount} ready
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-6 items-center px-2 text-[10px] font-medium uppercase tracking-[0.12em]",
                      SUPPORT_COLORS.planned,
                    )}
                  >
                    {plannedCount} planned
                  </span>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setSelectedPlugin(null)}
            className="self-start pt-3 flex size-6 items-center justify-center text-foreground/50 transition-colors hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          {selectedPlugin?.commands.map((cmd) => (
            <li key={cmd.id} className="border-b last:border-0">
              <button
                onClick={() =>
                  selectedPlugin && onSelectCommand?.(selectedPlugin.id, cmd)
                }
                className="group/command sidebar-fade-item w-full px-4 py-2 text-left text-foreground/60 transition-colors hover:text-sidebar-accent-foreground"
              >
                <div className="min-w-0">
                  <p className="min-w-0 font-mono text-base font-light">{cmd.id}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {cmd.runnerSupport && (
                      <span
                        className={cn(
                          "inline-flex items-center border-0 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                          SUPPORT_COLORS[cmd.runnerSupport],
                        )}
                      >
                        {cmd.runnerSupport}
                      </span>
                    )}
                  </div>
                   <p className="mt-1.5 text-xs text-foreground/60">
                    {cmd.description}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
