"use client";

import * as React from "react";
import {
  CheckIcon,
  MagnifyingGlassIcon,
  SquaresFourIcon,
  XIcon,
} from "@phosphor-icons/react";

import {
  getFrameworkCatalog,
  type FrameworkCatalogItem,
} from "@/lib/framework-catalogs";
import { type CommandFormField } from "@/lib/plugins";
import { useClickOutside } from "@/hooks/use-click-outside";
import { cn } from "@/lib/utils";

export function FrameworkControlsPanel({
  field,
  open,
  onApply,
  onClose,
  selectedValues,
}: {
  field: CommandFormField | null;
  open: boolean;
  onApply: (values: string[]) => void;
  onClose: () => void;
  selectedValues: string[];
}) {
  const panelRef = useClickOutside<HTMLDivElement>(onClose, open);
  const [query, setQuery] = React.useState("");
  const [draftSelections, setDraftSelections] = React.useState<string[]>(selectedValues);

  const picker =
    field?.picker?.kind === "framework-catalog" ? field.picker : null;
  const catalog = picker ? getFrameworkCatalog(picker.catalog) : null;
  const selectionMode = picker?.selectionMode ?? "single";

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    setDraftSelections(selectedValues);
  }, [open, selectedValues]);

  const filteredItems = React.useMemo(() => {
    if (!catalog) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return catalog.items;
    }

    return catalog.items.filter((item) => matchesItem(item, normalizedQuery));
  }, [catalog, query]);

  const title = picker?.title ?? catalog?.title ?? field?.label ?? "Framework Controls";
  return (
    <div
      ref={panelRef}
      className={cn(
        "h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
        open ? "w-[var(--app-sidebar-w)] opacity-100" : "w-0 opacity-0",
      )}
    >
      <div className="flex h-full min-h-0 w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] flex-col overflow-hidden border-l bg-background text-foreground">
        <div className="flex h-[calc(var(--row-h)*2)] shrink-0 items-center justify-between border-b px-4">
          <div className="flex min-w-0 flex-col gap-0">
            <span className="truncate text-sm font-medium">{title}</span>
            <span className="truncate text-xs text-foreground/50">
              {selectionMode === "multiple" ? "multi-select" : "single select"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex size-6 items-center justify-center self-start pt-3 text-foreground/50 transition-colors hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
          <div className="sticky top-0 z-10 group/search-row relative shrink-0 flex h-(--row-h) min-h-(--row-h) max-h-(--row-h) items-center overflow-hidden border-b border-border/70 bg-background/68 px-2 backdrop-blur-md">
            <MagnifyingGlassIcon className="size-3.5 shrink-0 text-foreground/50" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search controls, groups, or sections"
              className="h-full w-full bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {!catalog ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-52">
                <p className="text-sm font-medium text-foreground">Catalog unavailable</p>
                <p className="mt-2 text-xs leading-5 text-foreground/55">
                  This field references a framework catalog that is not registered in the web app yet.
                </p>
              </div>
            </div>
          ) : filteredItems.length > 0 ? (
            <ul>
              {filteredItems.map((item) => {
                const selected =
                  selectionMode === "multiple"
                    ? draftSelections.includes(item.value)
                    : selectedValues.includes(item.value);

                return (
                  <li key={item.value} className="border-b last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectionMode === "multiple") {
                          setDraftSelections((current) =>
                            current.includes(item.value)
                              ? current.filter((value) => value !== item.value)
                              : [...current, item.value],
                          );
                          return;
                        }

                        onApply([item.value]);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/35",
                        selected ? "bg-accent/20" : null,
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center border",
                          selected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/60 text-transparent",
                        )}
                      >
                        <CheckIcon className="size-3" weight="bold" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {item.label}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-foreground/40">
                          {item.kind}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-52">
                <p className="text-sm font-medium text-foreground">No matches</p>
                <p className="mt-2 text-xs leading-5 text-foreground/55">
                  Try a control family, control ID, or category name.
                </p>
              </div>
            </div>
          )}
        </div>

        {selectionMode === "multiple" ? (
          <div className="flex shrink-0 items-center justify-between border-t px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 text-xs text-foreground/55">
              <SquaresFourIcon className="size-3.5 shrink-0" />
              <span className="truncate">{draftSelections.length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftSelections([])}
                className="h-8 border border-border/60 px-3 text-xs font-medium text-foreground/70 transition-colors hover:bg-accent"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => onApply(draftSelections)}
                className="h-8 border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                Apply
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function matchesItem(item: FrameworkCatalogItem, query: string) {
  if (item.value.toLowerCase().includes(query)) {
    return true;
  }

  if (item.label.toLowerCase().includes(query)) {
    return true;
  }

  if (item.kind.toLowerCase().includes(query)) {
    return true;
  }

  return item.keywords?.some((keyword) => keyword.toLowerCase().includes(query)) ?? false;
}
