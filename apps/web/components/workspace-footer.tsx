"use client"

import { CaretUpDownIcon, CheckIcon, DownloadSimpleIcon, NotePencilIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"

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
}

export function WorkspaceFooter({
  activeWorkspaceId,
  onAddWorkspace,
  onCloseWorkspace,
  onRenameWorkspace,
  workspaces,
  setActiveWorkspaceId,
}: {
  activeWorkspaceId: string
  onAddWorkspace: () => void
  onCloseWorkspace: (id: string) => void
  onRenameWorkspace: () => void
  workspaces: WorkspaceLike[]
  setActiveWorkspaceId: (id: string) => void
}) {
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? workspaces[0]

  return (
    <footer className="flex h-(--row-h) shrink-0 items-center justify-between border-t border-border/70 bg-background/90 px-2">
      <div className="flex h-full items-center pr-2">
        <div className="flex h-full items-center border-r border-border/70 pr-2">
          <Popover>
            <PopoverTrigger className="flex h-full items-center gap-2 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <span className="truncate">{activeWorkspace.title}</span>
              <CaretUpDownIcon className="size-3.5 shrink-0" />
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverPositioner side="top" align="start" sideOffset={8}>
                <PopoverContent className="w-56">
                  <ul>
                    {workspaces.map((workspace) => (
                      <li key={workspace.id} className="border-b last:border-0">
                        <button
                          onClick={() => setActiveWorkspaceId(workspace.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                            workspace.id === activeWorkspace.id && "font-medium"
                          )}
                        >
                          <span className="truncate">{workspace.title}</span>
                          {workspace.id === activeWorkspace.id && <CheckIcon className="size-3.5 shrink-0" weight="bold" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </PopoverPositioner>
            </PopoverPortal>
          </Popover>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onRenameWorkspace}
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <NotePencilIcon className="size-3.5" />
          Rename workspace
        </button>
        <button className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <DownloadSimpleIcon className="size-3.5" />
          Export workspace
        </button>
        <button
          onClick={() => onCloseWorkspace(activeWorkspace.id)}
          disabled={workspaces.length === 1}
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <TrashIcon className="size-3.5" />
          Delete workspace
        </button>
        <button
          onClick={onAddWorkspace}
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <PlusIcon className="size-3.5" />
          Add workspace
        </button>
      </div>
    </footer>
  )
}
