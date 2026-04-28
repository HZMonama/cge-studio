"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import {
  BroadcastIcon,
  CaretUpDownIcon,
  CheckIcon,
  DownloadSimpleIcon,
  FolderSimplePlusIcon,
  NotePencilIcon,
  TrashIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ElementType } from "react"

interface FooterActionButtonProps {
  onClick: () => void
  disabled?: boolean
  icon: ElementType
  label: string
}

function FooterActionButton({ onClick, disabled, icon: Icon, label }: FooterActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex h-[4vh] min-w-0 shrink-0 items-center gap-1.5 rounded-none px-3 text-xs font-medium leading-none transition-colors",
        disabled
          ? "cursor-not-allowed text-muted-foreground/40"
          : "bg-transparent text-muted-foreground hover:bg-background/52 hover:text-foreground"
      )}
    >
      <span className="relative flex size-3.5 shrink-0 items-center justify-center">
        <Icon
          className={cn("size-3.5 transition-opacity", !disabled && "group-hover:opacity-0")}
          weight="regular"
        />
        <Icon
          className={cn("absolute inset-0 size-3.5 opacity-0 transition-opacity", !disabled && "group-hover:opacity-100")}
          weight="fill"
        />
      </span>
      {label && <span className="relative truncate leading-none">{label}</span>}
    </button>
  )
}

interface WorkspaceLike {
  id: string
  title: string
  rootPath: string
}

export function WorkspaceFooter({
  activeWorkspaceId,
  onAddWorkspace,
  onCloseWorkspace,
  onExportWorkspace,
  onRefreshWorkspace,
  onRenameWorkspace,
  refreshPending = false,
  workspaces,
  setActiveWorkspaceId,
}: {
  activeWorkspaceId: string | null
  onAddWorkspace: () => void
  onCloseWorkspace: (id: string) => void
  onExportWorkspace: () => void
  onRefreshWorkspace: () => void
  onRenameWorkspace: () => void
  refreshPending?: boolean
  workspaces: WorkspaceLike[]
  setActiveWorkspaceId: (id: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const activeWorkspace = mounted
    ? (workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null)
    : null
  const [selectorPopoverOpen, setSelectorPopoverOpen] = useState(false)
  const [selectorPopoverMode, setSelectorPopoverMode] = useState<"list" | "details">("list")

  if (!mounted) {
    return (
      <footer className="flex h-(--row-h) shrink-0 items-center justify-between border-t border-border/70 bg-background/90 px-2">
        <div className="flex h-full min-w-0 items-center pr-2">
          <div className="mr-1 flex size-8 shrink-0 items-center justify-center text-muted-foreground/40">
            <BroadcastIcon className="size-3.5" />
          </div>
          <div className="flex h-full min-w-0 items-center border-r border-border/70 pr-2">
            <div className="min-w-0 px-2">
              <p className="truncate text-xs text-muted-foreground/40">No workspace</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex h-[4vh] items-center gap-1.5 px-2.5 text-xs text-muted-foreground/40">
            <NotePencilIcon className="size-3.5" />
            Rename Workspace
          </div>
          <div className="flex h-[4vh] items-center gap-1.5 px-2.5 text-xs text-muted-foreground/40">
            <DownloadSimpleIcon className="size-3.5" />
            Export Workspace
          </div>
          <div className="flex h-[4vh] items-center gap-1.5 px-2.5 text-xs text-muted-foreground/40">
            <TrashIcon className="size-3.5" />
            Delete Workspace
          </div>
          <div className="flex h-[4vh] items-center gap-1.5 rounded border border-transparent px-2.5 text-xs text-muted-foreground">
            <FolderSimplePlusIcon className="size-3.5" />
            Add workspace
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="flex h-(--row-h) shrink-0 items-center justify-between border-t border-border/70 bg-background/90 px-2">
      <div className="flex h-full min-w-0 items-center pr-2">
        <FooterActionButton
          onClick={onRefreshWorkspace}
          disabled={!activeWorkspace || refreshPending}
          icon={BroadcastIcon}
          label=""
        />
        <div className="flex h-full min-w-0 items-center border-r border-border/70 pr-2">
          <Popover open={selectorPopoverOpen} onOpenChange={setSelectorPopoverOpen}>
            <PopoverTrigger
              disabled={!activeWorkspace}
              onClick={() => {
                setSelectorPopoverMode("list")
                setSelectorPopoverOpen(true)
              }}
              onContextMenu={(event) => {
                if (!activeWorkspace) {
                  return
                }

                event.preventDefault()
                setSelectorPopoverMode("details")
                setSelectorPopoverOpen(true)
              }}
              className="group flex h-full min-w-0 items-center gap-2 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="min-w-0 text-left">
                <p className="truncate text-xs text-foreground">{activeWorkspace?.title ?? "No workspace"}</p>
              </div>
              <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                <CaretUpDownIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
                <CaretUpDownIcon
                  weight="fill"
                  className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                />
              </span>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverPositioner side="top" align="start" sideOffset={8}>
                <PopoverContent className={cn(selectorPopoverMode === "list" ? "w-72" : "w-80")}>
                  {selectorPopoverMode === "list" ? (
                    <ul>
                      {workspaces.map((workspace) => (
                        <li key={workspace.id} className="border-b last:border-0">
                          <button
                            onClick={() => {
                              setActiveWorkspaceId(workspace.id)
                              setSelectorPopoverOpen(false)
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                              workspace.id === activeWorkspace?.id && "font-medium"
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate">{workspace.title}</p>
                              <p className="truncate font-mono text-[10px] text-muted-foreground/50">{workspace.id}</p>
                            </div>
                            {workspace.id === activeWorkspace?.id && <CheckIcon className="size-3.5 shrink-0" weight="bold" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-2 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
                        Workspace path
                      </p>
                      <p className="break-all text-xs text-foreground">
                        {activeWorkspace?.rootPath}
                      </p>
                    </div>
                  )}
                </PopoverContent>
              </PopoverPositioner>
            </PopoverPortal>
          </Popover>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-2">
        <FooterActionButton
          onClick={onRenameWorkspace}
          disabled={!activeWorkspace}
          icon={NotePencilIcon}
          label="Rename Workspace"
        />
        <FooterActionButton
          onClick={onExportWorkspace}
          disabled={true}
          icon={DownloadSimpleIcon}
          label="Export Workspace"
        />
        <FooterActionButton
          onClick={() => activeWorkspace && onCloseWorkspace(activeWorkspace.id)}
          disabled={!activeWorkspace}
          icon={TrashIcon}
          label="Delete Workspace"
        />
        <FooterActionButton
          onClick={onAddWorkspace}
          icon={FolderSimplePlusIcon}
          label="Add Workspace"
        />
      </div>
    </footer>
  )
}
