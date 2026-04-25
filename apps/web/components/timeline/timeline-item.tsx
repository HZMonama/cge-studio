"use client";

import { motion } from "motion/react";
import {
  CaretDownIcon,
  CommandIcon,
  FileTextIcon,
  FlagIcon,
  TerminalWindowIcon,
  ToolboxIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { type TimelineItem } from "./types";
import {
  getTimelineItemId,
  isArtifactTimelineItem,
  isDangerTimelineItem,
  isCollapsibleTimelineItem,
  defaultCollapsedForItem,
  timelineItemLabel,
} from "./utils";
import { EventBody } from "./event-body";

export function TimelineItemRow({
  item,
  collapsedItems,
  onToggleCollapse,
  onSubmitPrompt,
  onSelectArtifact,
}: {
  item: TimelineItem;
  collapsedItems: Record<string, boolean>;
  onToggleCollapse: (itemId: string, collapsed: boolean) => void;
  onSubmitPrompt: (promptId: string, answers: Record<string, string>) => Promise<void>;
  onSelectArtifact: (artifactId: string) => void;
}) {
  const itemId = getTimelineItemId(item);
  const collapsible = isCollapsibleTimelineItem(item);
  const collapsed = collapsible
    ? (collapsedItems[itemId] ?? defaultCollapsedForItem(item))
    : false;
  const danger = isDangerTimelineItem(item);
  const artifactCreated = isArtifactTimelineItem(item);

  const headerClassName = cn(
    "flex w-full items-center justify-between gap-3 text-xs tracking-[0.14em]",
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
        {item.kind === "stream" ? (
          <span className={iconContainerClassName}>
            <TerminalWindowIcon className="size-4 shrink-0" />
          </span>
        ) : item.event.type === "run.failed" ? (
          <span className={iconContainerClassName}>
            <WarningCircleIcon className="size-4 shrink-0" />
          </span>
        ) : item.event.type === "run.completed" ? (
          <span className={iconContainerClassName}>
            <FlagIcon className="size-4 shrink-0" />
          </span>
        ) : artifactCreated ? (
          <span className={iconContainerClassName}>
            <FileTextIcon className="size-4 shrink-0 text-primary" />
          </span>
        ) : item.event.type.startsWith("tool.") ? (
          <span className={iconContainerClassName}>
            <ToolboxIcon className="size-4 shrink-0" />
          </span>
        ) : (
          <span className={iconContainerClassName}>
            <CommandIcon className="size-4 shrink-0" />
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

  return (
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
          onClick={() => onToggleCollapse(itemId, !collapsed)}
          className={cn(rowClassName, headerClassName, "group text-left")}
        >
          {header}
        </button>
      ) : (
        <div className={cn(rowClassName, headerClassName)}>{header}</div>
      )}
      {!collapsed ? (
        item.kind === "stream" ? (
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
        ) : (
          <div className="px-6 pb-4">
            <EventBody
              event={item.event}
              onSelectArtifact={onSelectArtifact}
              onSubmitPrompt={onSubmitPrompt}
            />
          </div>
        )
      ) : null}
    </motion.div>
  );
}
