import { type RunnerRun, type RunnerRunEvent } from "@/lib/runner";
import { type TimelineItem } from "./types";

export function statusTone(status: RunnerRun["status"]) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-400";
  if (status === "canceled") return "bg-slate-500/10 text-slate-400";
  if (status === "failed") return "bg-rose-500/10 text-rose-400";
  if (status === "running") return "bg-sky-500/10 text-sky-400";
  return "bg-muted text-muted-foreground";
}

export function getTimelineItemId(item: TimelineItem) {
  return item.kind === "stream" ? `stream:${item.id}` : item.event.id;
}

export function isArtifactTimelineItem(item: TimelineItem) {
  return item.kind === "event" && item.event.type === "artifact.created";
}

export function isCollapsibleTimelineItem(_item: TimelineItem) {
  return true;
}

export function defaultCollapsedForItem(item: TimelineItem) {
  if (item.kind === "stream") return false;
  if (item.event.type === "run.failed") return false;
  if (item.event.type === "run.canceled") return false;
  if (item.event.type === "message") return false;
  if (item.event.type === "prompt.required") return false;
  if (item.event.type === "tool.completed" && Number(item.event.data.exitCode ?? 0) !== 0) {
    return false;
  }
  return true;
}

export function isDangerTimelineItem(item: TimelineItem) {
  return (item.kind === "stream" && item.stream === "stderr")
    || (item.kind === "event" && item.event.type === "run.failed");
}

export function coerceString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function toTimelineItems(events: RunnerRunEvent[]): TimelineItem[] {
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

export function timelineItemLabel(item: TimelineItem) {
  if (item.kind === "stream") return item.stream === "stderr" ? "StdErr" : "StdOut";

  switch (item.event.type) {
    case "run.created":
      return "Run Queued";
    case "run.started":
      return "Run Started";
    case "tool.started": {
      const toolName = coerceString(item.event.data.command);
      return toolName ? toolName : "Tool Used";
    }
    case "tool.completed":
      return "Tool Finished";
    case "artifact.created":
      return "Artifact Created";
    case "message":
      return coerceString(item.event.data.role) === "user" ? "Input Captured" : "Runner Message";
    case "prompt.required":
      return coerceString(item.event.data.title) || "Additional Input Required";
    case "run.completed":
      return "Run Completed";
    case "run.canceled":
      return "Run Canceled";
    case "run.failed":
      return "Run Failed";
    default:
      return item.event.type;
  }
}
