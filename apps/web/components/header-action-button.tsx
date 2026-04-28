"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function HeaderActionButton({
  children,
  className,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:bg-background",
        className,
      )}
    >
      {children}
    </button>
  );
}
