"use client"

import {
  WarningCircleIcon,
  UsersIcon,
  FileTextIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export type ProgramTab = "risks" | "vendors" | "policies" | "controls"

const TABS: { id: ProgramTab; label: string; icon: typeof WarningCircleIcon }[] = [
  { id: "risks", label: "Risks", icon: WarningCircleIcon },
  { id: "vendors", label: "Vendors", icon: UsersIcon },
  { id: "policies", label: "Policies", icon: FileTextIcon },
  { id: "controls", label: "Controls", icon: ShieldCheckIcon },
]

interface ProgramTabsProps {
  activeTab: ProgramTab | null
  onSelectTab: (tab: ProgramTab | null) => void
}

export function ProgramTabs({ activeTab, onSelectTab }: ProgramTabsProps) {
  return (
    <div className="flex h-[5vh] min-h-[5vh] shrink-0 items-center border-t border-border/70 bg-background">
      {TABS.map((tab, index) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              "group relative flex h-full min-w-0 flex-1 items-center justify-center gap-2 px-4 text-xs font-medium transition-colors",
              index !== 0 && "border-l border-border/70",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <span className="relative flex size-4 items-center justify-center">
              <Icon className={cn("size-4 transition-opacity", isActive ? "opacity-0" : "opacity-100 group-hover:opacity-0")} />
              <Icon weight="fill" className={cn("absolute inset-0 size-4 transition-opacity", isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
            </span>
            <span className="truncate">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
