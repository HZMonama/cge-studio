"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type RecordHeaderMetaItem = {
  label: string;
  value: string;
};

export function RecordHeader({
  actions,
  badges,
  eyebrow,
  identifier,
  meta,
  title,
}: {
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  eyebrow?: string | null;
  identifier?: string | null;
  meta?: RecordHeaderMetaItem[];
  title: string;
}) {
  return (
    <div className="border-b border-border/70 bg-background px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
              {eyebrow}
            </p>
          ) : null}
          {badges ? <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div> : null}
          <h2 className="mt-3 text-base font-semibold leading-snug text-foreground">{title}</h2>
          {identifier ? (
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{identifier}</p>
          ) : null}
          {meta && meta.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {meta.map((item) => (
                <span key={`${item.label}:${item.value}`} className="text-muted-foreground">
                  <span className="text-foreground/70">{item.label}</span>
                  {" "}
                  <span className={cn("text-muted-foreground")}>{item.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
