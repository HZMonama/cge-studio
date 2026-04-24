"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  CaretDownIcon,
  ClockCounterClockwiseIcon,
  CommandIcon,
  FileTextIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { type RunnerRun, type RunnerRunEvent } from "@/lib/runner";
import { cn } from "@/lib/utils";

const INSPECTOR_SHORTCUTS = [
  { id: "github-inspector", label: "GitHub Inspector", icon: "/github_dark.svg" },
  { id: "aws-inspector",    label: "AWS Inspector",    icon: "/aws_dark.svg" },
  { id: "gcp-inspector",    label: "GCP Inspector",    icon: "/google_cloud.svg" },
  { id: "okta-inspector",   label: "Okta Inspector",   icon: "/okta_dark.png" },
];

function statusTone(status: RunnerRun["status"]) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-400";
  if (status === "failed") return "bg-rose-500/10 text-rose-400";
  if (status === "running") return "bg-sky-500/10 text-sky-400";
  return "bg-muted text-muted-foreground";
}

type TimelineItem =
  | { kind: "event"; event: RunnerRunEvent }
  | { kind: "stream"; id: string; stream: "stdout" | "stderr"; createdAt: string; text: string };

function getTimelineItemId(item: TimelineItem) {
  return item.kind === "stream" ? `stream:${item.id}` : item.event.id;
}

function isCommandItem(item: TimelineItem) {
  if (item.kind === "stream") return true;
  return item.event.type.startsWith("run.") || item.event.type.startsWith("tool.");
}

function isArtifactTimelineItem(item: TimelineItem) {
  return item.kind === "event" && item.event.type === "artifact.created";
}

function isCollapsibleTimelineItem(item: TimelineItem) {
  return true;
}

function timelineItemLabel(item: TimelineItem) {
  if (item.kind === "stream") return item.stream;

  switch (item.event.type) {
    case "run.created":
      return "Run queued";
    case "run.started":
      return "Run started";
    case "tool.started":
      return "Tool started";
    case "tool.completed":
      return "Tool finished";
    case "artifact.created":
      return "Artifact created";
    case "message":
      return coerceString(item.event.data.role) === "user" ? "Input captured" : "Runner message";
    case "prompt.required":
      return coerceString(item.event.data.title) || "Additional input required";
    case "run.completed":
      return "Run completed";
    case "run.failed":
      return "Run failed";
    default:
      return item.event.type;
  }
}

function defaultCollapsedForItem(item: TimelineItem) {
  if (item.kind === "stream") return false;
  if (item.event.type === "run.failed") return false;
  if (item.event.type === "tool.completed" && Number(item.event.data.exitCode ?? 0) !== 0) {
    return false;
  }
  return true;
}

function isDangerTimelineItem(item: TimelineItem) {
  return (item.kind === "stream" && item.stream === "stderr")
    || (item.kind === "event" && item.event.type === "run.failed");
}

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
        <p className="text-sm leading-6 text-muted-foreground">
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
        {preview ? (
          <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground">
            {preview}
          </pre>
        ) : null}
        {command.length > 0 ? (
          <pre className={preview ? "mt-2 overflow-x-auto whitespace-pre-wrap wrap-break-word border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground" : "overflow-x-auto whitespace-pre-wrap wrap-break-word border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground"}>
            {command.join(" ")}
          </pre>
        ) : null}
      </div>
    );
  }

  if (event.type === "tool.completed") {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Exit Code {String(event.data.exitCode ?? "?")}
        </p>
      </div>
    );
  }

  if (event.type === "artifact.created") {
    const artifactId = coerceString(event.data.artifactId);
    return (
      <div>
        <button
          onClick={() => artifactId && onSelectArtifact(artifactId)}
          className="flex w-full items-center gap-3 border border-primary/25 bg-primary/6 px-3 py-2 text-left transition-colors hover:bg-primary/10"
        >
          <FileTextIcon className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-primary">
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
        <pre className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-muted-foreground">
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
        <p className="text-sm leading-6 text-muted-foreground">
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
        const fieldType = coerceString(field.type) || "textarea";
        const options = Array.isArray(field.options)
          ? (field.options as Array<Record<string, unknown>>)
          : [];
        return (
          <div key={id} className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              {coerceString(field.label)}
            </span>
            {fieldType === "select" ? (
              <select
                value={values[id] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [id]: event.target.value,
                  }))
                }
                className="w-full border border-border/60 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-border"
              >
                <option value="" disabled>
                  {coerceString(field.placeholder) || "Select…"}
                </option>
                {options.map((opt) => (
                  <option key={coerceString(opt.value)} value={coerceString(opt.value)}>
                    {coerceString(opt.label)}
                  </option>
                ))}
              </select>
            ) : fieldType === "checkboxes" ? (
              <div className="grid grid-cols-2 gap-1.5">
                {options.map((opt) => {
                  const val = coerceString(opt.value);
                  const checked = (values[id] ?? "").split(",").filter(Boolean).includes(val);
                  return (
                    <label
                      key={val}
                      className="flex cursor-pointer items-center gap-2 border border-border/40 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/40 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setValues((current) => {
                            const prev = (current[id] ?? "").split(",").filter(Boolean);
                            const next = checked ? prev.filter((v) => v !== val) : [...prev, val];
                            return { ...current, [id]: next.join(",") };
                          });
                        }}
                        className="accent-primary size-3 shrink-0"
                      />
                      {coerceString(opt.label)}
                    </label>
                  );
                })}
              </div>
            ) : (
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
            )}
          </div>
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
  onQuickRun,
  run,
}: {
  events: RunnerRunEvent[];
  loading: boolean;
  onSubmitPrompt: (promptId: string, answers: Record<string, string>) => Promise<void>;
  onSelectArtifact: (artifactId: string) => void;
  onQuickRun?: (commandPath: string) => void;
  run: RunnerRun | null;
}) {
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  if (!run) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <div className="w-max text-center">
          <motion.p
            className="text-[48pt] font-semibold leading-none tracking-tight text-foreground"
            initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: [0.25, 0, 0.2, 1] }}
          >
            CGE Studio
          </motion.p>
          <motion.p
            className="mt-2 text-2xl font-normal italic text-muted-foreground/60"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.45, ease: [0.25, 0, 0.2, 1], delay: 0.1 }}
          >
            alpha
          </motion.p>
          <motion.div
            className="mt-14"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0, 0.2, 1], delay: 0.22 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-dashed border-border/40" />
              <span className="font-mono text-[11px] text-muted-foreground/40">Start here</span>
              <div className="flex-1 border-t border-dashed border-border/40" />
            </div>
            <div className="mt-6 flex items-center justify-center gap-3">
              {INSPECTOR_SHORTCUTS.map((inspector, i) => (
                <motion.button
                  key={inspector.id}
                  type="button"
                  onClick={() => onQuickRun?.(`/${inspector.id}:setup`)}
                  className="inline-flex items-center gap-2.5 border border-border/60 bg-card/60 p-2.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.35, ease: [0.25, 0, 0.2, 1], delay: 0.32 + i * 0.06 }}
                >
                  <img src={inspector.icon} alt="" className="w-4 h-4 flex-shrink-0 object-contain" />
                  <span className="ml-1">{inspector.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const items = toTimelineItems(events);

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
          Loading run events…
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center px-6 py-16 text-center">
          <div className="max-w-md">
            <p className="text-sm font-medium text-foreground">No events yet</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This run has been created, but the runner has not recorded any event frames yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {items.map((item) => {
            const itemId = getTimelineItemId(item);
            const collapsible = isCollapsibleTimelineItem(item);
            const collapsed = collapsible
              ? (collapsedItems[itemId] ?? defaultCollapsedForItem(item))
              : false;
            const danger = isDangerTimelineItem(item);
            const artifactCreated = isArtifactTimelineItem(item);
            const headerClassName =
              cn(
                "flex w-full items-center justify-between gap-3 text-xs uppercase tracking-[0.14em]",
                danger ? "text-rose-400" : "text-muted-foreground",
              );
            const rowClassName = "px-6 py-4";
            const iconContainerClassName = "relative inline-flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[0.2rem]";
            const labelClassName = cn(
              "truncate",
              artifactCreated ? "text-primary" : null,
            );

            const header = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  {item.kind === "event" && item.event.type === "run.failed" ? (
                    <span className={iconContainerClassName}>
                      <WarningCircleIcon className="size-4 shrink-0" />
                    </span>
                  ) : artifactCreated ? (
                    <span className={iconContainerClassName}>
                      <FileTextIcon className="size-4 shrink-0 text-primary" />
                    </span>
                  ) : isCommandItem(item) ? (
                    <span className={iconContainerClassName}>
                      <CommandIcon className="size-4 shrink-0" />
                    </span>
                  ) : item.kind === "stream" ? (
                    <span className={iconContainerClassName}>
                      <TerminalWindowIcon className="size-4 shrink-0" />
                    </span>
                  ) : (
                    <span className={iconContainerClassName}>
                      <ClockCounterClockwiseIcon className="size-4 shrink-0" />
                    </span>
                  )}
                  <span className={labelClassName}>
                    {timelineItemLabel(item)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span>
                    {new Date(
                      item.kind === "stream" ? item.createdAt : item.event.createdAt,
                    ).toLocaleTimeString()}
                  </span>
                  {collapsible ? (
                    <span className="flex size-4 items-center justify-center">
                      <CaretDownIcon
                        className={cn(
                          "size-4 transition-all",
                          collapsed
                            ? "opacity-0 group-hover:opacity-100"
                            : "rotate-180 opacity-70 group-hover:opacity-100",
                        )}
                      />
                    </span>
                  ) : null}
                </span>
              </>
            );

            return item.kind === "stream" ? (
              <motion.div
                key={itemId}
                initial={{ opacity: 0, filter: "blur(6px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                {collapsible ? (
                  <button
                    type="button"
                    aria-expanded={!collapsed}
                    onClick={() =>
                      setCollapsedItems((current) => ({
                        ...current,
                        [itemId]: !collapsed,
                      }))
                    }
                    className={cn(rowClassName, headerClassName, "group text-left")}
                  >
                    {header}
                  </button>
                ) : (
                  <div className={cn(rowClassName, headerClassName)}>{header}</div>
                )}
                {!collapsed ? (
                  <pre
                    className={cn(
                      "mx-6 mb-4 overflow-x-auto whitespace-pre-wrap break-words border px-3 py-2 text-xs leading-5",
                      item.stream === "stderr"
                        ? "border-rose-500/20 bg-rose-500/5 text-rose-200"
                        : "border-border/60 bg-muted/20 text-foreground",
                    )}
                  >
                    {item.text}
                  </pre>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key={itemId}
                initial={{ opacity: 0, filter: "blur(6px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                {collapsible ? (
                  <button
                    type="button"
                    aria-expanded={!collapsed}
                    onClick={() =>
                      setCollapsedItems((current) => ({
                        ...current,
                        [itemId]: !collapsed,
                      }))
                    }
                    className={cn(rowClassName, headerClassName, "group text-left")}
                  >
                    {header}
                  </button>
                ) : (
                  <div className={cn(rowClassName, headerClassName)}>{header}</div>
                )}
                {!collapsed ? (
                  <div className="px-6 pb-4">
                    <EventBody
                      event={item.event}
                      onSelectArtifact={onSelectArtifact}
                      onSubmitPrompt={onSubmitPrompt}
                    />
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
