"use client";

import * as React from "react";
import {
  CaretDownIcon,
  CaretUpIcon,
  ClockCounterClockwiseIcon,
  LightningIcon,
  XIcon,
} from "@phosphor-icons/react";

import {
  buildPromptFromCommandForm,
  getCommandFormOptions,
  isCommandFormValid,
  type CommandFormValue,
  type CommandFormValues,
} from "@/lib/command-form";
import {
  getPluginCategory,
  type Command,
  type CommandFormField,
  type Plugin,
} from "@/lib/plugins";
import { type RunnerRun, type RunnerRunEvent } from "@/lib/runner";
import { cn } from "@/lib/utils";
import { RunnerTimeline } from "./runner-timeline";

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
  key: string;
  output?: string;
  path: string;
  pluginId: string;
  pluginLabel: string;
};

function InlineFormField({
  field,
  value,
  onChange,
}: {
  field: CommandFormField;
  value: CommandFormValue;
  onChange: (nextValue: CommandFormValue) => void;
}) {
  const options = getCommandFormOptions(field);

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

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-foreground">
        {field.label}
        {field.required && <span className="ml-1 text-rose-400">*</span>}
      </span>
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className={cn(
          "h-10 w-full border border-border/60 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border",
          field.type === "path" && "font-mono",
        )}
      />
      {field.description && (
        <p className="mt-1 text-xs text-muted-foreground">
          {field.description}
        </p>
      )}
    </label>
  );
}

export function ChatSurface({
  commandFormValues,
  events,
  focusToken,
  loadingEvents,
  onClearRunner,
  onClearSelectedCommand,
  onCommandFormChange,
  onOpenArtifact,
  onSelectCommand,
  onOpenHistory,
  onSubmitPrompt,
  onRun,
  runPending,
  run,
  plugins,
  prompt,
  selectedCommand,
  selectedCommandPath,
  setPrompt,
}: {
  commandFormValues: CommandFormValues;
  events: RunnerRunEvent[];
  focusToken: number;
  loadingEvents: boolean;
  onClearRunner: () => void;
  onClearSelectedCommand: () => void;
  onCommandFormChange: (values: CommandFormValues) => void;
  onOpenArtifact: (artifactId: string) => void;
  onSelectCommand: (path: string) => void;
  onOpenHistory: () => void;
  onSubmitPrompt: (promptId: string, answers: Record<string, string>) => Promise<void>;
  onRun: () => void;
  runPending: boolean;
  run: RunnerRun | null;
  plugins: Plugin[];
  prompt: string;
  selectedCommand: Command | null;
  selectedCommandPath: string | null;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [activeCommandIndex, setActiveCommandIndex] = React.useState(0);
  const [composerCollapsed, setComposerCollapsed] = React.useState(false);
  const slashCommands = React.useMemo<SlashCommand[]>(
    () =>
      plugins.flatMap((plugin) =>
        plugin.commands.map((command) => ({
          category: getPluginCategory(plugin),
          command,
          commandId: command.id,
          description: command.description,
          key: `${plugin.id}:${command.id}`,
          output: command.output,
          path: `/${plugin.id}:${command.id}`,
          pluginId: plugin.id,
          pluginLabel: plugin.label,
        })),
      ),
    [plugins],
  );

  const selectedForm = selectedCommand?.form ?? null;
  const inlineFormActive = Boolean(
    selectedCommand && selectedForm?.mode === "inline",
  );

  const trimmedPrompt = prompt.trimStart();
  const commandQuery =
    !inlineFormActive &&
    trimmedPrompt.startsWith("/") &&
    !trimmedPrompt.includes(" ")
      ? trimmedPrompt.slice(1).toLowerCase()
      : "";
  const canRun = inlineFormActive
    ? Boolean(
        selectedCommand && isCommandFormValid(selectedForm, commandFormValues),
      )
    : /^\/[a-z0-9-]+:[a-z0-9-]+/i.test(trimmedPrompt);

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
    <div className="relative flex flex-1 flex-col overflow-hidden bg-(--editor-bg)">
      {/* Scroll view */}
      <div className="flex-1 overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
        <div className="pt-[5vh] pb-40">
          <RunnerTimeline
            events={events}
            loading={loadingEvents}
            onSelectArtifact={onOpenArtifact}
            onSubmitPrompt={onSubmitPrompt}
            run={run}
          />
        </div>
      </div>

      {/* Floating run bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[5vh] min-h-10 items-center justify-between gap-4 border-b border-border/70 bg-background/88 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          {run ? (
            <>
              <span className="truncate font-mono text-xs text-foreground">
                {run.commandPath ?? run.prompt ?? run.id}
              </span>
              <span
                className={cn(
                  "shrink-0 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                  run.status === "completed" && "bg-emerald-500/10 text-emerald-400",
                  run.status === "failed" && "bg-rose-500/10 text-rose-400",
                  run.status === "running" && "bg-sky-500/10 text-sky-400",
                  run.status === "planned" && "bg-muted text-muted-foreground",
                )}
              >
                {run.status}
              </span>
            </>
          ) : null}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            onClick={onClearRunner}
            className="group flex h-8 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <XIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-6">
        <div className="pointer-events-auto w-full max-w-[80%]">
          <div className="border border-border/70 bg-background">
            {inlineFormActive && selectedCommand ? (
              <div className="flex items-center border-b border-border/70">
                <button
                  onClick={() => setComposerCollapsed((v) => !v)}
                  className="flex h-11 shrink-0 items-center justify-center border-r border-border/70 px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={composerCollapsed ? "Expand composer" : "Collapse composer"}
                >
                  {composerCollapsed ? (
                    <CaretUpIcon className="size-3.5" />
                  ) : (
                    <CaretDownIcon className="size-3.5" />
                  )}
                </button>
                <button
                  onClick={onClearSelectedCommand}
                  className="flex h-11 shrink-0 items-center justify-center border-r border-border/70 px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Clear selected command"
                >
                  <XIcon className="size-3.5" />
                </button>
                <input
                  ref={inputRef}
                  value={generatedPrompt}
                  readOnly
                  disabled
                  placeholder="Type / to choose a command"
                  className="h-11 w-full bg-transparent px-4 font-mono text-sm text-emerald-400 outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:text-emerald-400"
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
              </div>
            ) : (
              <div className="flex items-center">
                <input
                  ref={inputRef}
                  value={prompt}
                  onChange={(event) => {
                    setActiveCommandIndex(0);
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
              </div>
            )}

            {!composerCollapsed && inlineFormActive && selectedForm && selectedCommand && (
              <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
                {selectedForm.fields.length === 0 ? (
                  <div className="border border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      No configuration required
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This command does not need any additional inputs. Review
                      the preview in the composer and press Run when you’re
                      ready.
                    </p>
                  </div>
                ) : (
                  selectedForm.fields.map((field) => (
                    <InlineFormField
                      key={field.name}
                      field={field}
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
            )}

            {!composerCollapsed && !inlineFormActive && commandQuery.length > 0 && (
              <div className="border-t border-border/70">
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
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                            index === activeCommandIndex && "bg-accent",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground">
                                {command.path}
                              </span>
                              {command.output && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {command.output}
                                </span>
                              )}
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
                    No commands match “{commandQuery}”.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
