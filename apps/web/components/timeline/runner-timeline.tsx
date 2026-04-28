"use client";

import { useMemo, useState } from "react";
import { type RunnerRun, type RunnerRunEvent } from "@/lib/runner";
import { toTimelineItems } from "./utils";
import { EmptyState } from "./empty-state";
import { TimelineItemRow } from "./timeline-item";

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

  const answeredPromptIds = useMemo(() => {
    const answered = new Set<string>();
    const promptIndices: number[] = [];

    for (let i = 0; i < events.length; i++) {
      if (events[i].type === "prompt.required") {
        promptIndices.push(i);
      }
    }

    for (const idx of promptIndices) {
      for (let j = idx + 1; j < events.length; j++) {
        const event = events[j];
        if (event.type === "message" && event.data.role === "user") {
          const id = typeof events[idx].data.promptId === "string" ? events[idx].data.promptId : "";
          if (id) answered.add(id);
          break;
        }
      }
    }

    return answered;
  }, [events]);

  if (!run) {
    return <EmptyState onQuickRun={onQuickRun} />;
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
          {items.map((item) => (
            <TimelineItemRow
              key={item.kind === "stream" ? `stream:${item.id}` : item.event.id}
              item={item}
              collapsedItems={collapsedItems}
              onToggleCollapse={(itemId, collapsed) =>
                setCollapsedItems((current) => ({
                  ...current,
                  [itemId]: collapsed,
                }))
              }
              onSubmitPrompt={onSubmitPrompt}
              onSelectArtifact={onSelectArtifact}
              answeredPromptIds={answeredPromptIds}
              runStatus={run.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
