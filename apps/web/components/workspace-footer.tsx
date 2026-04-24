"use client"

import { useState } from "react"
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
  const activeWorkspace =
    workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null
  const [selectorPopoverOpen, setSelectorPopoverOpen] = useState(false)
  const [selectorPopoverMode, setSelectorPopoverMode] = useState<"list" | "details">("list")

  return (
    <footer className="flex h-(--row-h) shrink-0 items-center justify-between border-t border-border/70 bg-background/90 px-2">
      <div className="flex h-full min-w-0 items-center pr-2">
        <button
          onClick={onRefreshWorkspace}
          disabled={!activeWorkspace || refreshPending}
          className="group mr-1 flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Refresh workspace"
          title="Refresh workspace"
        >
          <span className={cn("relative flex size-3.5 items-center justify-center", refreshPending && "animate-spin")}>
            <BroadcastIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
            <BroadcastIcon
              weight="fill"
              className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
            />
          </span>
        </button>
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

      <div className="flex items-center gap-1">
        <button
          onClick={onRenameWorkspace}
          disabled={!activeWorkspace}
          className="group flex h-[4vh] items-center gap-1.5 rounded border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border/45 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="relative flex size-3.5 items-center justify-center">
            <NotePencilIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
            <NotePencilIcon
              weight="fill"
              className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
            />
          </span>
          Rename workspace
        </button>
        <button
          onClick={onExportWorkspace}
          disabled={!activeWorkspace}
          className="group flex h-[4vh] items-center gap-1.5 rounded border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border/45 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="relative flex size-3.5 items-center justify-center">
            <DownloadSimpleIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
            <DownloadSimpleIcon
              weight="fill"
              className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
            />
          </span>
          Export workspace
        </button>
        <button
          onClick={() => activeWorkspace && onCloseWorkspace(activeWorkspace.id)}
          disabled={!activeWorkspace}
          className="group flex h-[4vh] items-center gap-1.5 rounded border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border/45 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="relative flex size-3.5 items-center justify-center">
            <TrashIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
            <TrashIcon
              weight="fill"
              className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
            />
          </span>
          Delete workspace
        </button>
        <button
          onClick={onAddWorkspace}
          className="group flex h-[4vh] items-center gap-1.5 rounded border border-transparent px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border/45 hover:bg-accent hover:text-foreground"
        >
          <span className="relative flex size-3.5 items-center justify-center">
            <FolderSimplePlusIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
            <FolderSimplePlusIcon
              weight="fill"
              className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
            />
          </span>
          Add workspace
        </button>
      </div>
    </footer>
  )
}
