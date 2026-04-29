"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRightIcon,
  CaretDownIcon,
  ClockCounterClockwiseIcon,
  LightningIcon,
  PipeIcon,
  SidebarSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import { PIPELINES, type Pipeline, type PipelineReadiness } from "@/lib/pipelines";

import {
  buildPromptFromCommandForm,
  getCommandFormOptions,
  isCommandFormValid,
  type CommandFormValue,
  type CommandFormValues,
} from "@/lib/command-form";
import {
  getCommandForm,
  getPluginCategory,
  type Command,
  type CommandFormField,
  type Plugin,
} from "@/lib/plugins";
import { type RunnerRun, type RunnerRunEvent } from "@/lib/runner";
import { cn } from "@/lib/utils";
import { RunnerTimeline } from "./timeline";
import { FilePickerModal } from "./file-picker";

function commandScore(command: SlashCommand, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return -1;

  const category = command.category.toLowerCase();
  const commandId = command.commandId.toLowerCase();
  const pluginId = command.pluginId.toLowerCase();
  const path = command.path.toLowerCase();

  if (commandId === normalizedQuery) return 100;
  if (pluginId === normalizedQuery) return 95;
  if (path === `/${normalizedQuery}`) return 92;
  if (commandId.startsWith(normalizedQuery)) return 88;
  if (pluginId.startsWith(normalizedQuery)) return 82;
  if (category.startsWith(normalizedQuery)) return 74;
  if (path.includes(`:${normalizedQuery}`)) return 68;
  if (path.includes(normalizedQuery)) return 60;
  if (category.includes(normalizedQuery)) return 52;
  return -1;
}

type SlashCommand = {
  category: string;
  command: Command;
  commandId: string;
  description: string;
  executionMode?: Command["executionMode"];
  key: string;
  path: string;
  pluginId: string;
  pluginLabel: string;
  runnerSupport?: Command["runnerSupport"];
  uiHint?: Command["uiHint"];
};

const SUPPORT_TONES: Record<"ready" | "planned", string> = {
  ready: "bg-emerald-500/15 text-emerald-400",
  planned: "bg-pink-500/15 text-pink-400",
};

const UI_HINT_TONES: Record<string, string> = {
  analysis: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  assessment: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  checklist: "border-teal-500/30 bg-teal-500/10 text-teal-400",
  mapping: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
  plan: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  policy: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400",
  config: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  status: "border-border/70 bg-muted/40 text-muted-foreground",
  code: "border-green-500/30 bg-green-500/10 text-green-400",
  score: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  report: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  document: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

function getRunStatusTag(runStatus: RunnerRun["status"]) {
  if (runStatus === "planned") {
    return {
      label: "Queued",
      tone: "bg-violet-500/10 text-violet-400",
    };
  }

  if (runStatus === "failed") {
    return {
      label: "Failed",
      tone: "bg-rose-500/10 text-rose-400",
    };
  }

  if (runStatus === "canceled") {
    return {
      label: "Canceled",
      tone: "bg-slate-500/10 text-slate-400",
    };
  }

  if (runStatus === "completed") {
    return {
      label: "Done",
      tone: "bg-emerald-500/10 text-emerald-400",
    };
  }

  if (runStatus === "pending") {
    return {
      label: "Pending",
      tone: "bg-amber-500/10 text-amber-400",
    };
  }

  return {
    label: "Running",
    tone: "bg-sky-500/10 text-sky-400",
  };
}

function PathInput({
  field,
  value,
  onChange,
}: {
  field: CommandFormField;
  value: CommandFormValue;
  onChange: (nextValue: CommandFormValue) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const stringValue = typeof value === "string" ? value : "";

  const handleSelect = React.useCallback(
    (paths: string[]) => {
      if (paths.length > 0) {
        // For multiple selection, join with commas
        onChange(paths.join(","));
      }
    },
    [onChange]
  );

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-rose-400">*</span>}
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={stringValue}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            className="h-10 flex-1 border border-border/60 bg-transparent px-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border"
          />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="h-10 border border-border/60 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Browse…
          </button>
        </div>
        {field.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
      </label>
      <FilePickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleSelect}
        pathType={(field as { pathType?: "file" | "directory" | "any" }).pathType || "any"}
        allowMultiple={(field as { allowMultiple?: boolean }).allowMultiple || false}
        title={`Select ${field.label}`}
      />
    </>
  );
}

function InlineFormField({
  field,
  onOpenFrameworkPicker,
  value,
  onChange,
}: {
  field: CommandFormField;
  onOpenFrameworkPicker?: (field: CommandFormField) => void;
  value: CommandFormValue;
  onChange: (nextValue: CommandFormValue) => void;
}) {
  const options = getCommandFormOptions(field);

  if (field.type === "path") {
    return <PathInput field={field} value={value} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <label className="flex items-start gap-3 border border-border/60 px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 rounded border-border bg-transparent"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            {field.label}
          </span>
          {field.description && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {field.description}
            </span>
          )}
        </span>
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-rose-400">*</span>}
        </span>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full border border-border/60 bg-transparent px-3 text-sm text-foreground outline-none focus:border-border"
        >
          <option value="">Select…</option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-background text-foreground"
            >
              {option.label}
            </option>
          ))}
        </select>
        {field.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
      </label>
    );
  }

  if (field.type === "multiselect") {
    const selectedValues = Array.isArray(value) ? value.map(String) : [];

    return (
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-rose-400">*</span>}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <label
                key={option.value}
                className="flex items-center gap-2 border border-border/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const nextValues = event.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((item) => item !== option.value);

                    onChange(nextValues);
                  }}
                  className="size-4 rounded border-border bg-transparent"
                />
                <span className="text-foreground">{option.label}</span>
              </label>
            );
          })}
        </div>
        {field.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
      </fieldset>
    );
  }

  if (field.type === "number") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-rose-400">*</span>}
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={
            typeof value === "number"
              ? String(value)
              : typeof value === "string"
                ? value
                : ""
          }
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="h-10 w-full border border-border/60 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border"
        />
        {field.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-rose-400">*</span>}
        </span>
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={field.repeatable ? 4 : 3}
          className="min-h-24 w-full resize-y border border-border/60 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border"
        />
        {field.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
      </label>
    );
  }

  if (field.type === "secret") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-1 text-rose-400">*</span>}
        </span>
        <input
          type="password"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="h-10 w-full border border-border/60 bg-transparent px-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border"
        />
        {field.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
      </label>
    );
  }

  const pickerEnabled =
    field.type === "text" &&
    field.picker?.kind === "framework-catalog" &&
    onOpenFrameworkPicker;

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground">
        {field.label}
        {field.required && <span className="ml-1 text-rose-400">*</span>}
      </span>
      <div className={pickerEnabled ? "flex gap-2" : undefined}>
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={cn(
            "h-10 border border-border/60 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border",
            pickerEnabled ? "min-w-0 flex-1" : "w-full",
          )}
        />
        {pickerEnabled ? (
          <button
            type="button"
            onClick={() => onOpenFrameworkPicker?.(field)}
            className="h-10 shrink-0 border border-border/60 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Select…
          </button>
        ) : null}
      </div>
      {field.description && (
        <p className="mt-1 text-xs text-muted-foreground">
          {field.description}
        </p>
      )}
    </label>
  );
}


function PipelineStepChain({ steps }: { steps: Pipeline["steps"] }) {
  const parallelGroups: Array<{ parallel: boolean; items: Pipeline["steps"] }> = [];
  for (const step of steps) {
    const last = parallelGroups[parallelGroups.length - 1];
    if (step.parallel && last?.parallel) {
      last.items.push(step);
    } else {
      parallelGroups.push({ parallel: !!step.parallel, items: [step] });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {parallelGroups.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && (
            <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground/50" />
          )}
          {group.parallel && group.items.length > 1 ? (
            <span className="flex items-center gap-1 border border-border/50 bg-muted/20 px-1.5 py-0.5">
              {group.items.map((step, si) => (
                <React.Fragment key={si}>
                  {si > 0 && (
                    <span className="text-[9px] text-muted-foreground/40">∥</span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {step.label}
                  </span>
                </React.Fragment>
              ))}
            </span>
          ) : (
            <span className="border border-border/50 bg-muted/20 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {group.items[0].label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PipelinesPanel({
  onRunPipeline,
  runPending,
}: {
  onRunPipeline: (path: string) => void;
  runPending: boolean;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className="max-h-[50vh] overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
      {PIPELINES.map((pipeline) => {
              const expanded = expandedId === pipeline.id;
              return (
                <div key={pipeline.id} className="border-b border-border/50 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : pipeline.id)}
                    className="composer-fade-item flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-foreground">
                        {pipeline.label}
                      </span>
                      <span className="mt-2 block">
                        <PipelineStepChain steps={pipeline.steps} />
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                        SUPPORT_TONES[pipeline.readiness],
                      )}
                    >
                      {pipeline.readiness}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="border-t border-border/50 bg-muted/10 px-4 py-3 space-y-3">
                          <p className="text-xs text-muted-foreground">{pipeline.description}</p>
                          <div>
                            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                              Steps
                            </p>
                            <ol className="space-y-1">
                              {pipeline.steps.map((step, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <span className="flex size-4 shrink-0 items-center justify-center border border-border/50 text-[9px] text-muted-foreground/60">
                                    {i + 1}
                                  </span>
                                  <span className="font-mono text-[11px] text-foreground">
                                    {step.command}
                                  </span>
                                  {step.parallel && (
                                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground/40">
                                      parallel
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                          {pipeline.inputs.length > 0 && (
                            <div>
                              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
                                Inputs
                              </p>
                              <ul className="space-y-0.5">
                                {pipeline.inputs.map((input) => (
                                  <li key={input.id} className="flex items-baseline gap-2 text-[11px]">
                                    <span className="font-mono text-foreground">
                                      {input.id}
                                    </span>
                                    <span className="text-muted-foreground/60">—</span>
                                    <span className="text-muted-foreground">
                                      {input.label}
                                      {input.required && (
                                        <span className="ml-1 text-rose-400">*</span>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={runPending || pipeline.readiness !== "ready"}
                              onClick={() => onRunPipeline(pipeline.path)}
                              className="inline-flex h-7 items-center gap-1.5 border border-primary/40 bg-primary/10 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20 disabled:pointer-events-none disabled:border-border/50 disabled:text-muted-foreground/40"
                            >
                              <LightningIcon className="size-3" />
                              {runPending ? "Running…" : pipeline.readiness === "ready" ? "Run pipeline" : "Not yet available"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
    </div>
  );
}

export function ChatSurface({
  commandFormValues,
  events,
  focusToken,
  loadingEvents,
  onEditAndRerun,
  onClearRunner,
  onClearSelectedCommand,
  onCommandFormChange,
  onCancelRun,
  onOpenArtifact,
  onOpenFrameworkPicker,
  onSelectCommand,
  onOpenHistory,
  onSubmitPrompt,
  onRun,
  onRunPipeline,
  onToggleSidebar,
  runPending,
  run,
  plugins,
  prompt,
  selectedCommand,
  selectedCommandPath,
  setPrompt,
  sidebarOpen,
}: {
  commandFormValues: CommandFormValues;
  events: RunnerRunEvent[];
  focusToken: number;
  loadingEvents: boolean;
  onEditAndRerun: () => void;
  onClearRunner: () => void;
  onClearSelectedCommand: () => void;
  onCommandFormChange: (values: CommandFormValues) => void;
  onCancelRun: () => void;
  onOpenArtifact: (artifactId: string) => void;
  onOpenFrameworkPicker: (field: CommandFormField) => void;
  onSelectCommand: (path: string) => void;
  onOpenHistory: () => void;
  onSubmitPrompt: (promptId: string, answers: Record<string, string>) => Promise<void>;
  onRun: () => void;
  onRunPipeline: (pipelinePath: string) => void;
  onToggleSidebar: () => void;
  runPending: boolean;
  run: RunnerRun | null;
  plugins: Plugin[];
  prompt: string;
  selectedCommand: Command | null;
  selectedCommandPath: string | null;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  sidebarOpen: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [activeCommandIndex, setActiveCommandIndex] = React.useState(0);
  const [composerCollapsed, setComposerCollapsed] = React.useState(false);
  const [pipelinesOpen, setPipelinesOpen] = React.useState(false);

  function togglePipelines() {
    setPipelinesOpen((v) => !v);
    if (!pipelinesOpen) setPrompt("");
  }
  const slashCommands = React.useMemo<SlashCommand[]>(
    () =>
      plugins.flatMap((plugin) =>
        plugin.commands.map((command) => ({
          category: getPluginCategory(plugin),
          command,
          commandId: command.id,
          description: command.description,
          executionMode: command.executionMode,
          key: `${plugin.id}:${command.id}`,
          path: `/${plugin.id}:${command.id}`,
          pluginId: plugin.id,
          pluginLabel: plugin.label,
          runnerSupport: command.runnerSupport,
          uiHint: command.uiHint,
        })),
      ),
    [plugins],
  );

  const selectedForm = getCommandForm(selectedCommand);
  const inlineFormActive = Boolean(
    selectedCommand && selectedForm?.mode === "inline",
  );
  const composerToneClass = inlineFormActive && selectedCommand
    ? "shadow-[inset_0_1px_0_rgba(190,242,100,0.24),inset_0_0_18px_rgba(132,204,22,0.09)]"
    : prompt.trim().length > 0
      ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_0_18px_rgba(255,255,255,0.06)]"
      : "shadow-[inset_0_1px_0_rgba(0,0,0,0.16),inset_0_0_18px_rgba(0,0,0,0.14)]";

  const trimmedPrompt = prompt.trimStart();
  const commandQuery =
    !inlineFormActive &&
    trimmedPrompt.startsWith("/") &&
    !trimmedPrompt.includes(" ")
      ? trimmedPrompt.slice(1).toLowerCase()
      : "";
  const typedCommandPath = trimmedPrompt.match(/^\/[a-z0-9-]+:[a-z0-9-]+/i)?.[0] ?? null;
  const typedCommand =
    typedCommandPath === null
      ? null
      : (slashCommands.find(
          (command) => command.path.toLowerCase() === typedCommandPath.toLowerCase(),
        ) ?? null);
  const selectedCommandRunnable = selectedCommand?.runnerSupport === "ready";
  const typedCommandRunnable = typedCommand?.runnerSupport === "ready";
  const canRun = inlineFormActive
    ? Boolean(
        selectedCommandRunnable &&
          selectedCommand &&
          isCommandFormValid(selectedForm, commandFormValues),
      )
    : Boolean(typedCommand && typedCommandRunnable);

  const filteredCommands =
    commandQuery.length > 0
      ? slashCommands
          .map((command) => ({
            command,
            score: commandScore(command, commandQuery),
          }))
          .filter((result) => result.score >= 0)
          .sort(
            (left, right) =>
              right.score - left.score ||
              left.command.path.localeCompare(right.command.path),
          )
          .map((result) => result.command)
          .slice(0, 8)
      : [];

  const generatedPrompt = React.useMemo(() => {
    if (!inlineFormActive || !selectedCommandPath) {
      return prompt;
    }

    return buildPromptFromCommandForm(
      selectedCommandPath,
      selectedForm,
      commandFormValues,
      { redactSecrets: true },
    );
  }, [
    commandFormValues,
    inlineFormActive,
    prompt,
    selectedCommandPath,
    selectedForm,
  ]);

  React.useEffect(() => {
    if (!inlineFormActive) {
      inputRef.current?.focus();
      const pos = prompt.length;
      inputRef.current?.setSelectionRange(pos, pos);
    }
  }, [focusToken, inlineFormActive, prompt]);

  function applyCommand(path: string) {
    onSelectCommand(path);
  }

  function handleRun() {
    onRun();
    setComposerCollapsed(true);
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (commandQuery.length === 0 || filteredCommands.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCommandIndex((prev) =>
        prev >= filteredCommands.length - 1 ? 0 : prev + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCommandIndex((prev) =>
        prev <= 0 ? filteredCommands.length - 1 : prev - 1,
      );
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      applyCommand(
        filteredCommands[activeCommandIndex]?.path ?? filteredCommands[0].path,
      );
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg)]">
      {/* Scroll view */}
      <div className="flex-1 overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
        <div className={cn("min-h-full", run ? "pt-[5vh] pb-40" : "h-full")}>
          <RunnerTimeline
            events={events}
            loading={loadingEvents}
            onSelectArtifact={onOpenArtifact}
            onSubmitPrompt={onSubmitPrompt}
            onQuickRun={onRunPipeline}
            run={run}
          />
        </div>
      </div>

      {/* Floating run bar */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex h-[5vh] min-h-10 items-center justify-between gap-4 border-b border-border/70 bg-background/88 px-4 backdrop-blur"
      >
        <div className="flex min-w-0 items-center gap-2">
          {run ? (() => {
            const statusTag = getRunStatusTag(run.status);
            return (
              <>
                <span
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center px-3 text-sm font-medium",
                    statusTag.tone,
                  )}
                >
                  {statusTag.label}
                </span>
                <span className="inline-flex h-8 min-w-0 items-center px-3">
                  <span className="truncate font-mono text-sm text-foreground">
                    {run.commandPath ?? run.prompt ?? run.id}
                  </span>
                </span>
              </>
            );
          })() : null}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            onClick={onCancelRun}
            disabled={!run || (run.status !== "running" && run.status !== "pending")}
            className="group flex h-8 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60"
          >
            <WarningCircleIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground group-disabled:text-muted-foreground/60" />
            Cancel
          </button>
          <button
            onClick={onEditAndRerun}
            disabled={!run || !(run.prompt ?? run.commandPreview ?? run.commandPath)}
            className="group flex h-8 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60"
          >
            <LightningIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground group-disabled:text-muted-foreground/60" />
            Edit &amp; rerun
          </button>
          <button
            onClick={onClearRunner}
            disabled={!run}
            className="group flex h-8 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60"
          >
            <XIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground group-disabled:text-muted-foreground/60" />
            Clear
          </button>
          <button
            onClick={onOpenHistory}
            className="group flex h-8 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span className="relative flex size-3.5 shrink-0 items-center justify-center">
              <ClockCounterClockwiseIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
              <ClockCounterClockwiseIcon
                weight="fill"
                className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
              />
            </span>
            History
          </button>
        </div>
      </div>

      {/* Floating composer */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-6 pb-6"
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0, 0.2, 1], delay: 0.06 }}
      >
        <div className="pointer-events-auto w-full max-w-[80%]">
          {/* Pipelines button */}
          <div className="mb-2 flex justify-center">
            <button
              onClick={togglePipelines}
              className={cn(
                "group flex items-center gap-2 border border-border/70 bg-background px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pipelinesOpen && "bg-accent text-foreground",
              )}
            >
              <span className="relative flex size-3.5 items-center justify-center">
                <PipeIcon
                  className={cn(
                    "size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0",
                    pipelinesOpen && "opacity-0",
                  )}
                />
                <PipeIcon
                  weight="fill"
                  className={cn(
                    "absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100",
                    pipelinesOpen && "opacity-100",
                  )}
                />
              </span>
              Pipelines
              <motion.span
                animate={{ rotate: pipelinesOpen ? 0 : 180 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                <CaretDownIcon className="size-3" />
              </motion.span>
            </button>
          </div>

          <div className="flex max-h-[70vh] flex-col border border-border/70 bg-background">
            <div className="shrink-0">
            <AnimatePresence initial={false} mode="wait">
              {inlineFormActive && selectedCommand ? (
                <motion.div
                  key="inline"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={cn("flex items-center border-b border-border/70", composerToneClass)}>
                    <button
                      onClick={() => setComposerCollapsed((v) => !v)}
                      className="flex h-11 shrink-0 items-center justify-center border-r border-border/70 px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={composerCollapsed ? "Expand composer" : "Collapse composer"}
                    >
                      <motion.span
                        animate={{ rotate: composerCollapsed ? 0 : 180 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center"
                      >
                        <CaretDownIcon className="size-3.5" />
                      </motion.span>
                    </button>
                    <button
                      onClick={onClearSelectedCommand}
                      className="flex h-11 shrink-0 items-center justify-center border-r border-border/70 px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Clear selected command"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                    <button
                      onClick={onToggleSidebar}
                      className={cn(
                        "group flex h-11 shrink-0 items-center gap-2 border-r border-border/70 px-4 text-xs font-medium transition-colors hover:bg-accent",
                        sidebarOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label={sidebarOpen ? "Hide plugins sidebar" : "Show plugins sidebar"}
                      title="Plugins"
                    >
                      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                        <SidebarSimpleIcon
                          className={cn(
                            "size-3.5 transition-all",
                            sidebarOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0"
                          )}
                          weight="regular"
                        />
                        <SidebarSimpleIcon
                          weight="fill"
                          className={cn(
                            "absolute inset-0 size-3.5 transition-all",
                            sidebarOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
                        />
                      </span>
                      Plugins
                    </button>
                    <input
                      ref={inputRef}
                      value={generatedPrompt}
                      readOnly
                      disabled
                      placeholder="Type / to choose a command"
                      className="h-11 w-full bg-transparent px-4 font-mono text-sm text-primary outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:text-primary"
                    />
                    {selectedCommand.runnerSupport ? (
                      <span
                        className={cn(
                          "mx-3 inline-flex h-6 shrink-0 items-center px-2 text-[10px] font-medium uppercase tracking-[0.12em]",
                          SUPPORT_TONES[selectedCommand.runnerSupport],
                        )}
                      >
                        {selectedCommand.runnerSupport}
                      </span>
                    ) : null}
                    <button
                      onClick={handleRun}
                      disabled={!canRun || runPending}
                      className={cn(
                        "group flex h-11 shrink-0 items-center gap-2 border-l border-border/70 px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60",
                        runPending && "bg-accent",
                      )}
                    >
                      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                        <LightningIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
                        <LightningIcon
                          weight="fill"
                          className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                        />
                      </span>
                      {runPending ? "Running" : "Run"}
                    </button>
                  </div>
                  {selectedCommand && !selectedCommandRunnable ? (
                    <p className="border-t border-border/60 px-4 py-2 text-xs text-amber-400">
                      Runner execution is not implemented for this command yet.
                    </p>
                  ) : null}
                </motion.div>
                ) : (
                <motion.div
                  key="text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn("flex items-center", composerToneClass)}
                >
                    <button
                    onClick={onToggleSidebar}
                    className={cn(
                      "group flex h-11 shrink-0 items-center gap-2 border-r border-border/70 px-4 text-xs font-medium transition-colors hover:bg-accent",
                      sidebarOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={sidebarOpen ? "Hide plugins sidebar" : "Show plugins sidebar"}
                    title="Plugins"
                  >
                    <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                      <SidebarSimpleIcon
                        className={cn(
                          "size-3.5 transition-all",
                          sidebarOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0"
                        )}
                        weight="regular"
                      />
                      <SidebarSimpleIcon
                        weight="fill"
                        className={cn(
                          "absolute inset-0 size-3.5 transition-all",
                          sidebarOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                      />
                    </span>
                    Plugins
                  </button>
                  <input
                    ref={inputRef}
                    value={prompt}
                    onChange={(event) => {
                      setActiveCommandIndex(0);
                      setPipelinesOpen(false);
                      setPrompt(event.target.value);
                    }}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Type / to choose a command"
                    className="h-11 w-full bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                  <button
                    onClick={handleRun}
                    disabled={!canRun || runPending}
                    className={cn(
                      "group flex h-11 shrink-0 items-center gap-2 border-l border-border/70 px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60",
                      runPending && "bg-accent",
                    )}
                  >
                    <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                      <LightningIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
                      <LightningIcon
                        weight="fill"
                        className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                      />
                    </span>
                    {runPending ? "Running" : "Run"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {!inlineFormActive && typedCommand && !typedCommandRunnable ? (
              <p className="border-t border-border/60 px-4 py-2 text-xs text-amber-400">
                Runner execution is not implemented for `{typedCommand.path}` yet.
              </p>
            ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
            <AnimatePresence initial={false}>
              {!composerCollapsed && inlineFormActive && selectedForm && selectedCommand && (
                <motion.div
                  key="form-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="space-y-4 px-4 py-4">
                    {selectedForm.fields.length === 0 ? (
                      <div className="border border-border/60 bg-muted/30 px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          No configuration required
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          This command does not need any additional inputs. Review
                          the preview in the composer and press Run when you're
                          ready.
                        </p>
                      </div>
                    ) : (
                      selectedForm.fields.map((field) => (
                        <InlineFormField
                          key={field.name}
                          field={field}
                          onOpenFrameworkPicker={onOpenFrameworkPicker}
                          value={commandFormValues[field.name]}
                          onChange={(nextValue) => {
                            onCommandFormChange({
                              ...commandFormValues,
                              [field.name]: nextValue,
                            });
                          }}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {!composerCollapsed && pipelinesOpen && !inlineFormActive && commandQuery.length === 0 && (
                <motion.div
                  key="pipelines"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                  className="border-t border-border/70"
                >
                  <PipelinesPanel
                    onRunPipeline={(path) => {
                      setPipelinesOpen(false);
                      setComposerCollapsed(true);
                      onRunPipeline(path);
                    }}
                    runPending={runPending}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {!composerCollapsed && !inlineFormActive && commandQuery.length > 0 && (
                <motion.div
                  key="search"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: "hidden" }}
                  className="border-t border-border/70"
                >
                  {filteredCommands.length > 0 ? (
                    <ul>
                      {filteredCommands.map((command, index) => (
                        <li
                          key={command.key}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <button
                            onClick={() => applyCommand(command.path)}
                            onMouseEnter={() => setActiveCommandIndex(index)}
                            className={cn(
                              "composer-fade-item flex w-full items-start gap-3 px-4 py-3 text-left",
                              index === activeCommandIndex && "composer-fade-item-active",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-medium text-foreground">
                                {command.path}
                              </span>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {command.runnerSupport ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                                      SUPPORT_TONES[command.runnerSupport],
                                    )}
                                  >
                                    {command.runnerSupport}
                                  </span>
                                ) : null}
                                {command.uiHint ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                                      UI_HINT_TONES[command.uiHint],
                                    )}
                                  >
                                    {command.uiHint}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {command.description}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                              {command.pluginLabel}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground">
                      No commands match "{commandQuery}".
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
