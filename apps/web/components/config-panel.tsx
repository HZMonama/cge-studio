"use client";

import { useEffect, useState } from "react";
import {
  CloudArrowUpIcon,
  DatabaseIcon,
  FloppyDiskIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  type ConnectorSummary,
  type RunnerConfigSnapshot,
  type RunnerHealthSnapshot,
} from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";

const CONNECTOR_ICONS: Record<string, string> = {
  "aws-inspector": "/aws_dark.svg",
  "gcp-inspector": "/google_cloud.svg",
  "github-inspector": "/github_dark.svg",
  "okta-inspector": "/okta_dark.png",
};

function Section({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-0">
      <div className="px-4 py-3">
        <p className="text-xs font-medium">{title}</p>
      </div>
      {children && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function ConfigPanel({
  config,
  connectors,
  health,
  savePending,
  onSave,
}: {
  config: RunnerConfigSnapshot | null;
  connectors: ConnectorSummary[];
  health: RunnerHealthSnapshot | null;
  savePending: boolean;
  onSave: (input: {
    toolkitPath: string;
  }) => Promise<void>;
}) {
  const { configOpen, closeConfig } = usePluginPanel();
  const [toolkitPath, setToolkitPath] = useState("");

  useEffect(() => {
    setToolkitPath(config?.toolkitPath ?? "");
  }, [config]);

  const toolkitConnected = Boolean(health?.toolkitConfigured);

  return (
    <div
      className={cn(
        "h-svh shrink-0 overflow-hidden transition-[width] duration-200",
        configOpen
          ? "w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)]"
          : "w-0 min-w-0 basis-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col border-l bg-sidebar text-sidebar-foreground">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-start justify-between border-b pl-4 pr-2 pt-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Configuration</span>
            <span className="text-xs text-sidebar-foreground/50">settings</span>
          </div>
          <button
            onClick={closeConfig}
            className="mt-0.5 flex size-6 items-center justify-center text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
          <Section title="Runner / CLI">
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-sidebar-border px-3 py-2">
                <span className="text-xs">CLI sync</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]",
                    toolkitConnected
                      ? "text-emerald-400"
                      : "text-amber-400",
                  )}
                >
                  {!toolkitConnected && (
                    <WarningCircleIcon className="size-3.5" weight="fill" />
                  )}
                  {toolkitConnected ? "Connected" : "Fallback"}
                </span>
              </div>

              <div className="space-y-2 text-[10px] leading-4 text-sidebar-foreground/45">
                <div>
                  <p className="uppercase tracking-[0.12em] text-sidebar-foreground/35">
                    Config root
                  </p>
                  <p>{health?.configRoot ?? "~/.config/claude-grc"}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-sidebar-foreground/35">
                    Cache root
                  </p>
                  <p>{health?.cacheRoot ?? "~/.cache/claude-grc"}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-sidebar-foreground/35">
                    Workspace location
                  </p>
                  <p>{config?.workspaceRoot ?? "~/Documents/CGE Workspaces"}</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.12em] text-sidebar-foreground/35">
                    Workspace registry
                  </p>
                  <p>{health?.workspacesRoot ?? "~/.local/share/cge-ui/workspaces/registry"}</p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Toolkit Path">
            <div className="space-y-2">
              <input
                value={toolkitPath}
                onChange={(event) => setToolkitPath(event.target.value)}
                placeholder="/path/to/claude-grc-engineering"
                className="w-full border border-sidebar-border bg-transparent px-2 py-1.5 text-xs placeholder:text-sidebar-foreground/30 focus:border-sidebar-ring focus:outline-none"
              />
              <p className="text-[10px] leading-4 text-sidebar-foreground/45">
                Path to the embedded or external `claude-grc-engineering` checkout.
              </p>
            </div>
          </Section>

          <Section title="Runner Config">
            <div className="space-y-3">
              <p className="break-all text-[10px] leading-4 text-sidebar-foreground/45">
                {config?.runnerConfigPath ?? "No writable runner config path available."}
              </p>
              <button
                onClick={() =>
                  void onSave({
                    toolkitPath,
                  })
                }
                disabled={savePending}
                className="flex w-full items-center justify-center gap-2 border border-sidebar-border px-3 py-2 text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:cursor-wait disabled:opacity-60"
              >
                <FloppyDiskIcon className="size-3.5" />
                {savePending ? "Saving configuration" : "Save configuration"}
              </button>
            </div>
          </Section>

          <Section title="Connectors">
            <ul className="space-y-2">
              {connectors.map((connector) => (
                <li
                  key={connector.id}
                  className="space-y-2 border border-sidebar-border px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex shrink-0 items-center gap-2 text-xs">
                      {CONNECTOR_ICONS[connector.id] ? (
                        <img
                          src={CONNECTOR_ICONS[connector.id]}
                          alt=""
                          className="size-3.5 object-contain"
                        />
                      ) : (
                        <CloudArrowUpIcon className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs">{connector.label}</p>
                      <span
                        className={cn(
                          "mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]",
                          connector.configured
                            ? "text-emerald-400"
                            : "text-rose-400",
                        )}
                      >
                        {connector.configured ? "Configured" : "Not configured"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-sidebar-foreground/45">
                    <span className="inline-flex items-center gap-1">
                      <DatabaseIcon className="size-3.5" />
                      {connector.findingsCached} cached
                    </span>
                  </div>

                  <div className="space-y-1 text-[10px] leading-4 text-sidebar-foreground/35">
                    <p className="break-all">Config: {connector.configPath}</p>
                    <p className="break-all">Cache: {connector.cachePath}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
