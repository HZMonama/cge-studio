"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type TabHeaderMetaItem = {
  label: string;
  value: string;
};

type PhosphorIcon = React.ComponentType<{
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  className?: string;
}>;

export function TabHeaderButton({
  icon: Icon,
  children,
  disabled,
  onClick,
  selected,
}: {
  icon: PhosphorIcon;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex h-[4vh] min-h-[4vh] items-center gap-1.5 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent",
        "disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:bg-background",
        selected && "bg-accent",
      )}
    >
      <span className="relative flex size-3 shrink-0">
        <Icon
          weight="regular"
          className={cn(
            "absolute inset-0 size-3 text-muted-foreground transition-opacity",
            "group-hover:opacity-0 group-disabled:opacity-100",
            selected && "opacity-0",
          )}
        />
        <Icon
          weight="fill"
          className={cn(
            "absolute inset-0 size-3 text-foreground opacity-0 transition-opacity",
            "group-hover:opacity-100 group-disabled:opacity-0",
            selected && "opacity-100",
          )}
        />
      </span>
      {children}
    </button>
  );
}

export function TabHeader({
  actions,
  badges,
  identifier,
  meta,
  title,
}: {
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  identifier?: string | null;
  meta?: TabHeaderMetaItem[];
  title: string;
}) {
  return (
    <div className="flex h-[5vh] min-h-[5vh] shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-background px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {badges ? <div className="flex shrink-0 items-center gap-1.5">{badges}</div> : null}
        <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
        {identifier ? (
          <span className="truncate font-mono text-xs text-muted-foreground">{identifier}</span>
        ) : null}
        {meta && meta.length > 0 ? (
          <div className="flex items-center gap-x-3 text-xs">
            {meta.map((item) => (
              <span key={`${item.label}:${item.value}`} className="text-muted-foreground">
                <span className="text-foreground/70">{item.label}</span>
                {" "}
                <span className="text-muted-foreground">{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
