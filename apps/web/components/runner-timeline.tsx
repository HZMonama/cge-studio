"use client";

import { useMemo, useState } from "react";
import { ClockCounterClockwiseIcon, FileTextIcon, TerminalWindowIcon, WarningCircleIcon } from "@phosphor-icons/react";

import { type RunnerRun, type RunnerRunEvent } from "@/lib/runner";
import { cn } from "@/lib/utils";

function statusTone(status: RunnerRun["status"]) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-400";
  if (status === "failed") return "bg-rose-500/10 text-rose-400";
  if (status === "running") return "bg-sky-500/10 text-sky-400";
  return "bg-muted text-muted-foreground";
}

type TimelineItem =
  | { kind: "event"; event: RunnerRunEvent }
  | { kind: "stream"; id: string; stream: "stdout" | "stderr"; createdAt: string; text: string };

function coerceString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toTimelineItems(events: RunnerRunEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const event of events) {
    if (event.type === "tool.stdout" || event.type === "tool.stderr") {
      const stream = event.type === "tool.stdout" ? "stdout" : "stderr";
      const text = coerceString(event.data.text);
      const previous = items[items.length - 1];

      if (previous?.kind === "stream" && previous.stream === stream) {
        previous.text += text;
        continue;
      }

      items.push({
        kind: "stream",
        id: event.id,
        stream,
        createdAt: event.createdAt,
        text,
      });
      continue;
    }

    items.push({ kind: "event", event });
  }

  return items;
}

function EventBody({
  event,
  onSubmitPrompt,
  onSelectArtifact,
}: {
  event: RunnerRunEvent;
  onSubmitPrompt: (promptId: string, answers: Record<string, string>) => Promise<void>;
  onSelectArtifact: (artifactId: string) => void;
}) {
  if (event.type === "run.created") {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">Run queued</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {coerceString(event.data.commandPath)}
        </p>
      </div>
    );
  }

  if (event.type === "run.started" || event.type === "tool.started") {
    const command = Array.isArray(event.data.args)
      ? [coerceString(event.data.command), ...event.data.args.map((value) => String(value))]
      : [];
    const preview = coerceString(event.data.commandPreview);

    return (
      <div>
        <p className="text-sm font-medium text-foreground">
          {event.type === "run.started" ? "Run started" : "Tool started"}
        </p>
        {preview ? (
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground">
            {preview}
          </pre>
        ) : null}
        {command.length > 0 ? (
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground">
            {command.join(" ")}
          </pre>
        ) : null}
      </div>
    );
  }

  if (event.type === "tool.completed") {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">Tool finished</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Exit code {String(event.data.exitCode ?? "?")}
        </p>
      </div>
    );
  }

  if (event.type === "artifact.created") {
    const artifactId = coerceString(event.data.artifactId);
    return (
      <div>
        <p className="text-sm font-medium text-foreground">Artifact created</p>
        <button
          onClick={() => artifactId && onSelectArtifact(artifactId)}
          className="mt-2 flex w-full items-center gap-3 border border-border/60 px-3 py-2 text-left transition-colors hover:bg-accent"
        >
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {coerceString(event.data.title)}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {coerceString(event.data.path)}
            </p>
          </div>
        </button>
      </div>
    );
  }

  if (event.type === "message") {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">
          {coerceString(event.data.role) === "user" ? "Input captured" : "Runner message"}
        </p>
        <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
          {coerceString(event.data.text)}
        </pre>
      </div>
    );
  }

  if (event.type === "prompt.required") {
    const promptId = coerceString(event.data.promptId);
    const fields = Array.isArray(event.data.fields)
      ? event.data.fields
      : [];

    return (
      <PromptForm
        fields={fields}
        promptId={promptId}
        submitLabel={coerceString(event.data.submitLabel) || "Submit"}
        title={coerceString(event.data.title) || "Additional input required"}
        onSubmit={onSubmitPrompt}
      />
    );
  }

  if (event.type === "run.completed" || event.type === "run.failed") {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">
          {event.type === "run.completed" ? "Run completed" : "Run failed"}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {coerceString(event.data.message) || `Exit code ${String(event.data.exitCode ?? "?")}`}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">{event.type}</p>
    </div>
  );
}

function PromptForm({
  fields,
  onSubmit,
  promptId,
  submitLabel,
  title,
}: {
  fields: Array<Record<string, unknown>>;
  onSubmit: (promptId: string, answers: Record<string, string>) => Promise<void>;
  promptId: string;
  submitLabel: string;
  title: string;
}) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        fields.map((field) => [coerceString(field.id), ""]),
      ),
    [fields],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void onSubmit(promptId, values).finally(() => setPending(false));
      }}
    >
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The workflow needs narrative context before it can generate the report.
        </p>
      </div>
      {fields.map((field) => {
        const id = coerceString(field.id);
        return (
          <label key={id} className="block">
            <span className="mb-1 block text-xs font-medium text-foreground">
              {coerceString(field.label)}
            </span>
            <textarea
              value={values[id] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [id]: event.target.value,
                }))
              }
              placeholder={coerceString(field.placeholder)}
              rows={3}
              className="w-full resize-y border border-border/60 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border"
            />
          </label>
        );
      })}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center border border-border/70 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60"
      >
        {pending ? "Submitting" : submitLabel}
      </button>
    </form>
  );
}

export function RunnerTimeline({
  events,
  loading,
  onSubmitPrompt,
  onSelectArtifact,
  run,
}: {
  events: RunnerRunEvent[];
  loading: boolean;
  onSubmitPrompt: (promptId: string, answers: Record<string, string>) => Promise<void>;
  onSelectArtifact: (artifactId: string) => void;
  run: RunnerRun | null;
}) {
  if (!run) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="max-w-lg text-center">
          <p className="text-sm font-medium text-foreground">No run selected</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Start with `/github-inspector:collect`, then run `/grc-engineer:gap-assessment` to build the first tracked pipeline path.
          </p>
        </div>
      </div>
    );
  }

  const items = toTimelineItems(events);

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-6 py-6">
      <div className="border border-border/70 bg-background px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                {run.commandPath ?? run.id}
              </p>
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
                  statusTone(run.status),
                )}
              >
                {run.status}
              </span>
              {run.executionMode ? (
                <span className="px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {run.executionMode}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(run.createdAt).toLocaleString()}
            </p>
            {run.commandPreview ? (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground">
                {run.commandPreview}
              </pre>
            ) : null}
          </div>
          <div className="max-w-sm text-xs leading-5 text-muted-foreground">
            The timeline renders typed runner events so script output, artifacts, and final status stay distinct from prose.
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto border border-border/70 bg-background [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
        {loading ? (
          <div className="flex h-full items-center justify-center px-6 py-10 text-sm text-muted-foreground">
            Loading run events…
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 py-10 text-center">
            <div className="max-w-md">
              <p className="text-sm font-medium text-foreground">No events yet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This run has been created, but the runner has not recorded any event frames yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map((item) =>
              item.kind === "stream" ? (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <TerminalWindowIcon className="size-3.5" />
                    <span>{item.stream}</span>
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <pre
                    className={cn(
                      "mt-3 overflow-x-auto whitespace-pre-wrap break-words border px-3 py-2 text-xs leading-5",
                      item.stream === "stderr"
                        ? "border-rose-500/20 bg-rose-500/5 text-rose-200"
                        : "border-border/60 bg-muted/20 text-foreground",
                    )}
                  >
                    {item.text}
                  </pre>
                </div>
              ) : (
                <div key={item.event.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {item.event.type === "run.failed" ? (
                      <WarningCircleIcon className="size-3.5" />
                    ) : (
                      <ClockCounterClockwiseIcon className="size-3.5" />
                    )}
                    <span>{item.event.type}</span>
                    <span>{new Date(item.event.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-3">
                    <EventBody
                      event={item.event}
                      onSelectArtifact={onSelectArtifact}
                      onSubmitPrompt={onSubmitPrompt}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
