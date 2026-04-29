"use client";

import Image from "next/image";
import { useState } from "react";
import {
  CaretDownIcon,
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
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type ClaudeCodeStatus,
  type CodexStatus,
  type RunnerConfigSnapshot,
  type RunnerHealthSnapshot,
} from "@/lib/runner";
import { usePluginPanel } from "@/stores/plugin-panel-store";
import { useThemeStore } from "@/stores/theme-store";
import { useClickOutside } from "@/hooks/use-click-outside";

type SignalTone = "ok" | "warn" | "error" | "unknown";
type AgentRuntime = "claude-code" | "codex";
const AGENT_RUNTIME_STORAGE_KEY = "cge.config.agentRuntime";

function signalDot(tone: SignalTone) {
  if (tone === "ok") return <CheckCircleIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" weight="fill" />;
  if (tone === "warn") return <WarningCircleIcon className="size-3.5 text-amber-600 dark:text-amber-400" weight="fill" />;
  if (tone === "error") return <XCircleIcon className="size-3.5 text-rose-600 dark:text-rose-400" weight="fill" />;
  return <CircleIcon className="size-3.5 text-foreground/40" weight="fill" />;
}

function Section({
  action,
  title,
  children,
}: {
  action?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-xs font-medium">{title}</p>
        {action}
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

const CODEX_MODELS = [
  { value: "", label: "Default" },
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
];

const AGENT_RUNTIMES: Array<{
  value: AgentRuntime;
  label: string;
}> = [
  {
    value: "claude-code",
    label: "Claude Code",
  },
  {
    value: "codex",
    label: "Codex",
  },
];

function readStoredAgentRuntime(): AgentRuntime {
  if (typeof window === "undefined") {
    return "claude-code";
  }

  const stored = window.localStorage.getItem(AGENT_RUNTIME_STORAGE_KEY);
  return stored === "codex" || stored === "claude-code" ? stored : "claude-code";
}

function AgentRuntimeTitle({
  runtime,
  theme,
}: {
  runtime: AgentRuntime;
  theme: "light" | "dark";
}) {
  const icon =
    runtime === "claude-code"
      ? "/claude-ai-icon.svg"
      : theme === "dark"
        ? "/Codex_dark.svg"
        : "/Codex_light.svg";
  const label = runtime === "claude-code" ? "Claude Code" : "Codex";

  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src={icon}
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0"
      />
      <span>{label}</span>
    </span>
  );
}

export function ConfigPanel({
  claudeCodeStatus,
  codexStatus,
  config,
  health,
  onSaveClaudeModel,
  onSaveCodexModel,
}: {
  claudeCodeStatus: ClaudeCodeStatus | null;
  codexStatus: CodexStatus | null;
  config: RunnerConfigSnapshot | null;
  health: RunnerHealthSnapshot | null;
  onSaveClaudeModel: (input: { model: string }) => Promise<void>;
  onSaveCodexModel: (input: { model: string }) => Promise<void>;
}) {
  const { configOpen, closeConfig } = usePluginPanel();
  const { theme, setTheme, mounted } = useThemeStore();
  const [agentRuntime, setAgentRuntime] = useState<AgentRuntime>(readStoredAgentRuntime);
  const [runtimePopoverOpen, setRuntimePopoverOpen] = useState(false);
  const [claudeModel, setClaudeModel] = useState<string | null>(null);
  const [codexModel, setCodexModel] = useState<string | null>(null);

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

          <Section
            title={<AgentRuntimeTitle runtime={agentRuntime} theme={mounted ? theme : "light"} />}
            action={
              <Popover open={runtimePopoverOpen} onOpenChange={setRuntimePopoverOpen}>
                <PopoverTrigger
                  aria-label="Select agent runtime"
                  className="flex size-6 items-center justify-center border border-border/70 text-foreground/50 transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <CaretDownIcon className="size-3.5" />
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverPositioner side="left" align="start" sideOffset={8}>
                    <PopoverContent className="w-64 p-1">
                      <div className="px-2 pb-1 pt-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/35">
                          Runtime
                        </p>
                      </div>
                      <div className="space-y-1">
                        {AGENT_RUNTIMES.map((runtime) => (
                          <button
                            key={runtime.value}
                            type="button"
                            onClick={() => {
                              setAgentRuntime(runtime.value);
                              window.localStorage.setItem(AGENT_RUNTIME_STORAGE_KEY, runtime.value);
                              setRuntimePopoverOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 border px-3 py-2 text-left transition-colors",
                              agentRuntime === runtime.value
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-transparent text-foreground/70 hover:border-border/70 hover:bg-accent hover:text-foreground",
                            )}
                          >
                            <span className="text-xs font-medium">{runtime.label}</span>
                            {agentRuntime === runtime.value && (
                              <CheckCircleIcon className="size-3.5 shrink-0" weight="fill" />
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </PopoverPositioner>
                </PopoverPortal>
              </Popover>
            }
          >
            {agentRuntime === "claude-code" ? (
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
                    value={claudeModel ?? claudeCodeStatus?.model ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setClaudeModel(value);
                      void onSaveClaudeModel({ model: value });
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
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                  <span className="text-xs">CLI</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.12em]",
                      codexStatus?.installed
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {codexStatus === null
                      ? "Unknown"
                      : codexStatus.installed
                        ? (codexStatus.version ?? "Installed")
                        : "Not installed"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                  <span className="text-xs">API key</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.12em]",
                      codexStatus?.apiKeyConfigured
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {codexStatus?.apiKeyConfigured ? "Configured" : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-border/70 px-3 py-2">
                  <span className="text-xs">Subscription</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.12em]",
                      codexStatus?.subscriptionLoginConfigured
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {codexStatus?.subscriptionLoginConfigured ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/35">
                    Model
                  </p>
                  <select
                    value={codexModel ?? codexStatus?.model ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCodexModel(value);
                      void onSaveCodexModel({ model: value });
                    }}
                    className="w-full border border-border/70 bg-background px-2 py-1.5 text-xs text-foreground focus:border-sidebar-ring focus:outline-none"
                  >
                    {CODEX_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
