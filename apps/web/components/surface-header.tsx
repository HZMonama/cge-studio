"use client";

import * as React from "react";

export function SurfaceHeader({
  actions,
  subtitle,
  title,
}: {
  actions?: React.ReactNode;
  subtitle?: string | null;
  title: string;
}) {
  return (
    <div className="flex h-[5vh] min-h-[5vh] shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-background px-6">
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
          {subtitle ? (
            <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
