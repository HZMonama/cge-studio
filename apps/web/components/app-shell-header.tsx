"use client";

import { useState, type ElementType } from "react";
import { motion } from "motion/react";
import {
  GearSixIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { usePluginPanel } from "@/stores/plugin-panel-store";

export interface AppHeaderSection {
  id: string;
  label: string;
  Icon: ElementType;
  disabled?: boolean;
}

function ConfigButton() {
  const { toggleConfig, configOpen } = usePluginPanel();

  return (
    <button
      onClick={toggleConfig}
      className={cn(
        "group relative flex h-[4vh] min-w-0 shrink-0 items-center gap-1.5 rounded-none px-3 text-xs font-medium leading-none transition-colors",
        configOpen
          ? "text-primary"
          : "bg-transparent text-muted-foreground hover:bg-background/52 hover:text-foreground",
      )}
      aria-label="Configuration"
      title="Configuration"
    >
      {configOpen && (
        <motion.span
          layoutId="header-btn-bg"
          className="absolute inset-0 rounded-none bg-border/70 shadow-sm"
          transition={{ duration: 0.2 }}
        />
      )}
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        <GearSixIcon
          className={cn(
            "size-3.5 transition-opacity",
            configOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0",
          )}
          weight="regular"
        />
        <GearSixIcon
          className={cn(
            "absolute inset-0 size-3.5 transition-opacity",
            configOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          weight="fill"
        />
      </span>
      <span className="relative truncate leading-none">Configuration</span>
    </button>
  );
}

export function AppShellHeader({
  activeSection,
  onSelectSection,
  sections,
}: {
  activeSection: string;
  onSelectSection: (section: string) => void;
  sections: AppHeaderSection[];
}) {
  return (
    <header className="z-20 flex h-(--row-h) min-h-(--row-h) max-h-(--row-h) shrink-0 items-center overflow-hidden border-b border-border/70 bg-background/88 backdrop-blur">
      {/* Branding - 20vw */}
      <div className="flex h-full w-[20vw] shrink-0 items-center px-4">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">CGE Studio</span>
          <span
            className="text-sm font-normal italic text-muted-foreground"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            Alpha
          </span>
        </div>
      </div>
      
      {/* Centered Tabs */}
      <div className="relative flex-1 self-stretch">
        <div className="flex h-full items-center justify-center gap-1.5 overflow-x-auto overflow-y-hidden px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => !section.disabled && onSelectSection(section.id)}
              disabled={section.disabled}
              title={section.disabled ? "Coming soon" : undefined}
              className={cn(
                "group relative flex h-[4vh] min-w-0 max-w-44 shrink-0 items-center gap-1.5 rounded-none px-3 text-xs font-medium leading-none transition-colors",
                section.disabled
                  ? "cursor-not-allowed bg-transparent text-muted-foreground/40"
                    : section.id === activeSection
                    ? "text-primary"
                    : "bg-transparent text-muted-foreground hover:bg-background/52 hover:text-foreground",
              )}
            >
              {section.id === activeSection && !section.disabled && (
                <motion.span
                  layoutId="header-btn-bg"
                  className="absolute inset-0 rounded-none bg-border/70 shadow-sm"
                  transition={{ duration: 0.2 }}
                />
              )}
              <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                <section.Icon
                  className={cn(
                    "size-3.5 transition-opacity",
                    !section.disabled && section.id === activeSection
                      ? "opacity-0"
                      : section.disabled
                        ? "opacity-100"
                        : "group-hover:opacity-0",
                  )}
                  weight="regular"
                />
                {!section.disabled && (
                  <section.Icon
                    className={cn(
                      "absolute inset-0 size-3.5 transition-opacity",
                      section.id === activeSection
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100",
                    )}
                    weight="fill"
                  />
                )}
              </span>
              <span className="relative truncate leading-none">{section.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Configuration button on the right - 20vw */}
      <div className="flex h-full w-[20vw] shrink-0 items-center justify-end px-3">
        <ConfigButton />
      </div>
    </header>
  );
}
