"use client"

import {
  ArrowsClockwiseIcon,
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
  activeArtifactCount,
  activeWorkspaceId,
  activeWorkspaceRunCount,
  onAddWorkspace,
  onCloseWorkspace,
  onExportWorkspace,
  onRefreshWorkspace,
  onRenameWorkspace,
  refreshPending = false,
  workspaces,
  setActiveWorkspaceId,
}: {
  activeArtifactCount: number
  activeWorkspaceId: string | null
  activeWorkspaceRunCount: number
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
    workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? workspaces[0] ?? null

  return (
    <footer className="flex h-(--row-h) shrink-0 items-center justify-between border-t border-border/70 bg-background/90 px-2">
      <div className="flex h-full min-w-0 items-center pr-2">
        <button
          onClick={onRefreshWorkspace}
          disabled={!activeWorkspace || refreshPending}
          className="mr-1 flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="Refresh workspace"
          title="Refresh workspace"
        >
          <ArrowsClockwiseIcon className={cn("size-3.5", refreshPending && "animate-spin")} />
        </button>
        <div className="flex h-full min-w-0 items-center border-r border-border/70 pr-2">
          <Popover>
            <PopoverTrigger
              disabled={!activeWorkspace}
              className="flex h-full min-w-0 items-center gap-2 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="min-w-0 text-left">
                <p className="truncate text-xs text-foreground">{activeWorkspace?.title ?? "No workspace"}</p>
                {activeWorkspace?.rootPath ? (
                  <p className="truncate text-[10px] text-muted-foreground/70">
                    {activeWorkspace.rootPath}
                  </p>
                ) : null}
              </div>
              <CaretUpDownIcon className="size-3.5 shrink-0" />
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverPositioner side="top" align="start" sideOffset={8}>
                <PopoverContent className="w-80">
                  <ul>
                    {workspaces.map((workspace) => (
                      <li key={workspace.id} className="border-b last:border-0">
                        <button
                          onClick={() => setActiveWorkspaceId(workspace.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                            workspace.id === activeWorkspace?.id && "font-medium"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate">{workspace.title}</p>
                            <p className="truncate text-[10px] font-normal text-muted-foreground/70">
                              {workspace.rootPath}
                            </p>
                          </div>
                          {workspace.id === activeWorkspace?.id && <CheckIcon className="size-3.5 shrink-0" weight="bold" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </PopoverPositioner>
            </PopoverPortal>
          </Popover>
        </div>
        <div className="hidden min-w-0 items-center gap-3 px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 md:flex">
          {activeWorkspace && <span>{activeWorkspaceRunCount} runs</span>}
          {activeWorkspace && <span>{activeArtifactCount} artifacts</span>}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onRenameWorkspace}
          disabled={!activeWorkspace}
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <NotePencilIcon className="size-3.5" />
          Rename workspace
        </button>
        <button
          onClick={onExportWorkspace}
          disabled={!activeWorkspace}
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <DownloadSimpleIcon className="size-3.5" />
          Export workspace
        </button>
        <button
          onClick={() => activeWorkspace && onCloseWorkspace(activeWorkspace.id)}
          disabled={!activeWorkspace}
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <TrashIcon className="size-3.5" />
          Delete workspace
        </button>
        <button
          onClick={onAddWorkspace}
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <FolderSimplePlusIcon className="size-3.5" />
          Add workspace
        </button>
      </div>
    </footer>
  )
}
