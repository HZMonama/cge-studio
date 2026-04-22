"use client";

import { type Command } from "@/lib/plugins";
import { XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { usePluginPanel } from "@/stores/plugin-panel-store";

const OUTPUT_COLORS: Record<string, string> = {
  report: "bg-blue-500/10 text-blue-400",
  code: "bg-green-500/10 text-green-400",
  document: "bg-amber-500/10 text-amber-400",
  status: "bg-muted text-muted-foreground",
  score: "bg-purple-500/10 text-purple-400",
};

export function PluginPanel({
  onSelectCommand,
}: {
  onSelectCommand?: (pluginId: string, command: Command) => void;
}) {
  const { selectedPlugin, setSelectedPlugin } = usePluginPanel();

  return (
    <div
      className={cn(
        "h-svh shrink-0 overflow-hidden transition-[width] duration-200",
        selectedPlugin ? "w-[var(--app-sidebar-w)]" : "w-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col border-l bg-sidebar text-sidebar-foreground">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-start justify-between border-b pl-4 pr-2 pt-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-sm font-medium">
              {selectedPlugin?.label}
            </span>
            {selectedPlugin && (
              <span className="text-xs text-sidebar-foreground/50 capitalize">
                {selectedPlugin.type}
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedPlugin(null)}
            className="mt-0.5 flex size-6 items-center justify-center text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
          {selectedPlugin?.commands.map((cmd) => (
            <li key={cmd.id} className="border-b last:border-0">
              <button
                onClick={() =>
                  selectedPlugin && onSelectCommand?.(selectedPlugin.id, cmd)
                }
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{cmd.id}</p>
                  <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                    {cmd.description}
                  </p>
                </div>
                {cmd.output && (
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 px-1.5 py-0.5 text-[10px] font-medium",
                      OUTPUT_COLORS[cmd.output],
                    )}
                  >
                    {cmd.output}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
