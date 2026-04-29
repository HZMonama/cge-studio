"use client";

import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  CircleIcon,
  MoonIcon,
  SunIcon,
  WarningCircleIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  type ClaudeCodeStatus,
  type RunnerConfigSnapshot,
  type RunnerHealthSnapshot,
} from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";
import { useThemeStore } from "@/stores/theme-store";
import { useClickOutside } from "@/hooks/use-click-outside";

type SignalTone = "ok" | "warn" | "error" | "unknown";

function signalDot(tone: SignalTone) {
  if (tone === "ok") return <CheckCircleIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" weight="fill" />;
  if (tone === "warn") return <WarningCircleIcon className="size-3.5 text-amber-600 dark:text-amber-400" weight="fill" />;
  if (tone === "error") return <XCircleIcon className="size-3.5 text-rose-600 dark:text-rose-400" weight="fill" />;
  return <CircleIcon className="size-3.5 text-foreground/40" weight="fill" />;
}

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

const CLAUDE_MODELS = [
  { value: "", label: "Default" },
  { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export function ConfigPanel({
  claudeCodeStatus,
  config,
  health,
  onSaveModel,
}: {
  claudeCodeStatus: ClaudeCodeStatus | null;
  config: RunnerConfigSnapshot | null;
  health: RunnerHealthSnapshot | null;
  onSaveModel: (input: { model: string }) => Promise<void>;
}) {
  const { configOpen, closeConfig } = usePluginPanel();
  const { theme, setTheme, mounted } = useThemeStore();
  const [claudeModel, setClaudeModel] = useState("");

  useEffect(() => {
    setClaudeModel(claudeCodeStatus?.model ?? "");
  }, [claudeCodeStatus]);

  const panelRef = useClickOutside<HTMLDivElement>(closeConfig, configOpen);

  return (
    <div
      ref={panelRef}
      className={cn(
        "h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
        configOpen
          ? "w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] opacity-100"
          : "w-0 min-w-0 basis-0 opacity-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col border-l bg-background text-foreground overflow-hidden">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-center justify-between border-b px-4">
          <div className="flex flex-col gap-0">
            <span className="text-sm font-medium">Configuration</span>
            <span className="text-xs text-foreground/50">settings</span>
          </div>
          <button
            onClick={closeConfig}
            className="self-start pt-3 flex size-6 items-center justify-center text-foreground/50 transition-colors hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          <Section title="Theme">
            <div className="flex gap-2">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 border px-3 py-2 text-xs transition-colors",
                  mounted && theme === "light"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/70 text-foreground/60 hover:text-foreground"
                )}
              >
                <SunIcon className="size-4" />
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 border px-3 py-2 text-xs transition-colors",
                  mounted && theme === "dark"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/70 text-foreground/60 hover:text-foreground"
                )}
              >
                <MoonIcon className="size-4" />
                Dark
              </button>
            </div>
          </Section>

          <Section title="System Health">
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                <span className="text-xs">CLI</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.12em]",
                      health?.toolkitConfigured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {health?.toolkitConfigured ? "Connected" : "Fallback"}
                  </span>
                  {signalDot(health?.toolkitConfigured ? "ok" : "warn")}
                </div>
              </div>
              <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                <span className="text-xs">Runner</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.12em]",
                      health?.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {health?.ok ? "Connected" : "Offline"}
                  </span>
                  {signalDot(health?.ok ? "ok" : "error")}
                </div>
              </div>
              <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                <span className="text-xs">Agent</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.12em]",
                      claudeCodeStatus?.installed
                        ? claudeCodeStatus?.apiKeyConfigured || claudeCodeStatus?.subscriptionLoginConfigured
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {claudeCodeStatus?.installed
                      ? claudeCodeStatus?.apiKeyConfigured || claudeCodeStatus?.subscriptionLoginConfigured
                        ? "Ready"
                        : "No Auth"
                      : "Not Installed"}
                  </span>
                  {signalDot(
                    claudeCodeStatus?.installed
                      ? claudeCodeStatus?.apiKeyConfigured || claudeCodeStatus?.subscriptionLoginConfigured
                        ? "ok"
                        : "warn"
                      : "error"
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Paths">
            <div className="space-y-2 text-[10px] leading-4 text-foreground/45">
              <div>
                <p className="uppercase tracking-[0.12em] text-foreground/35">Config</p>
                <p className="break-all">{health?.configRoot ?? "~/.config/claude-grc"}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-foreground/35">Cache</p>
                <p className="break-all">{health?.cacheRoot ?? "~/.cache/claude-grc"}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-foreground/35">Workspaces</p>
                <p className="break-all">{config?.workspaceRoot ?? "~/Documents/CGE Workspaces"}</p>
              </div>
              <div>
                <p className="uppercase tracking-[0.12em] text-foreground/35">Registry</p>
                <p className="break-all">{health?.workspacesRoot ?? "~/.local/share/cge-ui/workspaces/registry"}</p>
              </div>
            </div>
          </Section>

          <Section title="Claude Code">
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                <span className="text-xs">CLI</span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.12em]",
                    claudeCodeStatus?.installed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {claudeCodeStatus === null
                    ? "Unknown"
                    : claudeCodeStatus.installed
                      ? (claudeCodeStatus.version ?? "Installed")
                      : "Not installed"}
                </span>
              </div>

              <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                <span className="text-xs">API key</span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.12em]",
                    claudeCodeStatus?.apiKeyConfigured
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {claudeCodeStatus?.apiKeyConfigured ? "Configured" : "Not set"}
                </span>
              </div>

              <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                <span className="text-xs">Subscription</span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.12em]",
                    claudeCodeStatus?.subscriptionLoginConfigured
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {claudeCodeStatus?.subscriptionLoginConfigured ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/35">
                  Model
                </p>
                <select
                  value={claudeModel}
                  onChange={(event) => {
                    const value = event.target.value;
                    setClaudeModel(value);
                    void onSaveModel({ model: value });
                  }}
                  className="w-full border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground focus:border-sidebar-ring focus:outline-none"
                >
                  {CLAUDE_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
