"use client"

import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import {
  Folder,
  File,
  House,
  ArrowUp,
  Eye,
  EyeSlash,
  Plus,
  X,
  Check,
} from "@phosphor-icons/react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useFileSystem } from "@/hooks/use-file-system"
import type { FilePickerOptions, FsEntry } from "@/lib/file-system"

interface FilePickerModalProps extends FilePickerOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (paths: string[]) => void
  title?: string
}

export function FilePickerModal({
  open,
  onOpenChange,
  onSelect,
  pathType = "any",
  allowMultiple = false,
  title = "Select Path",
}: FilePickerModalProps) {
  const [showHidden, setShowHidden] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const {
    homePath,
    currentPath,
    entries,
    loading,
    error: fsError,
    setPath,
    refresh,
    createDirectory,
  } = useFileSystem({ showHidden })

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPaths(new Set())
      setError(null)
      setIsCreatingFolder(false)
      setNewFolderName("")
    }
  }, [open])

  // Load last used path from localStorage
  useEffect(() => {
    if (open && homePath) {
      const lastPath = localStorage.getItem("cge-filepicker-lastPath")
      if (lastPath && lastPath.startsWith(homePath)) {
        setPath(lastPath)
      }
    }
  }, [open, homePath, setPath])

  // Sync external error
  useEffect(() => {
    if (fsError) {
      setError(fsError)
    }
  }, [fsError])

  const handleSelect = useCallback(() => {
    if (selectedPaths.size === 0) {
      setError("Please select at least one item")
      return
    }

    // Save last used path
    localStorage.setItem("cge-filepicker-lastPath", currentPath)

    onSelect(Array.from(selectedPaths))
    onOpenChange(false)
  }, [selectedPaths, currentPath, onSelect, onOpenChange])

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return

    setError(null)
    const success = await createDirectory(newFolderName.trim())

    if (success) {
      setNewFolderName("")
      setIsCreatingFolder(false)
    }
  }, [newFolderName, createDirectory])

  const handleToggleHidden = useCallback(() => {
    setShowHidden((prev) => {
      const newValue = !prev
      localStorage.setItem("cge-filepicker-showHidden", String(newValue))
      return newValue
    })
  }, [])

  // Load showHidden preference
  useEffect(() => {
    const saved = localStorage.getItem("cge-filepicker-showHidden")
    if (saved) {
      setShowHidden(saved === "true")
    }
  }, [])

  const handleNavigateUp = useCallback(() => {
    if (!currentPath || currentPath === homePath) return
    const parent = currentPath.split("/").slice(0, -1).join("/") || homePath || "/"
    setPath(parent)
  }, [currentPath, homePath, setPath])

  const handleNavigateHome = useCallback(() => {
    if (homePath) {
      setPath(homePath)
    }
  }, [homePath, setPath])

  const handleEntryClick = useCallback((entry: FsEntry) => {
    const fullPath = `${currentPath}/${entry.name}`

    if (entry.type === "directory") {
      if (pathType === "directory" || pathType === "any") {
        // Toggle selection for directories
        setSelectedPaths((prev) => {
          const next = new Set(prev)
          if (next.has(fullPath)) {
            next.delete(fullPath)
          } else {
            if (!allowMultiple) next.clear()
            next.add(fullPath)
          }
          return next
        })
      } else {
        // Navigate into directory
        setPath(fullPath)
      }
    } else {
      // File selection
      if (pathType === "file" || pathType === "any") {
        setSelectedPaths((prev) => {
          const next = new Set(prev)
          if (next.has(fullPath)) {
            next.delete(fullPath)
          } else {
            if (!allowMultiple) next.clear()
            next.add(fullPath)
          }
          return next
        })
      }
    }

    setError(null)
  }, [currentPath, pathType, allowMultiple, setPath])

  const handleDoubleClick = useCallback((entry: FsEntry) => {
    const fullPath = `${currentPath}/${entry.name}`

    if (entry.type === "directory") {
      setPath(fullPath)
    } else if (pathType === "file" || pathType === "any") {
      // Select file on double click and confirm
      onSelect([fullPath])
      localStorage.setItem("cge-filepicker-lastPath", currentPath)
      onOpenChange(false)
    }
  }, [currentPath, pathType, onSelect, onOpenChange, setPath])

  const isSelected = (entry: FsEntry) => {
    return selectedPaths.has(`${currentPath}/${entry.name}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 py-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNavigateHome}
            disabled={currentPath === homePath}
            title="Home"
          >
            <House className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNavigateUp}
            disabled={currentPath === homePath}
            title="Up"
          >
            <ArrowUp className="size-4" />
          </Button>
          <div className="flex-1 px-2 py-1 text-sm bg-muted rounded truncate">
            {currentPath}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleHidden}
            title={showHidden ? "Hide hidden files" : "Show hidden files"}
          >
            {showHidden ? <Eye className="size-4" /> : <EyeSlash className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreatingFolder(true)}
            title="New Folder"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {/* New Folder Input */}
        {isCreatingFolder && (
          <div className="flex items-center gap-2 py-2">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder()
                if (e.key === "Escape") {
                  setIsCreatingFolder(false)
                  setNewFolderName("")
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleCreateFolder}>
              <Check className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsCreatingFolder(false)
                setNewFolderName("")
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-auto border rounded my-2 min-h-[300px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Empty directory
            </div>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => (
                <div
                  key={entry.name}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted transition-colors",
                    isSelected(entry) && "bg-primary/10"
                  )}
                  onClick={() => handleEntryClick(entry)}
                  onDoubleClick={() => handleDoubleClick(entry)}
                >
                  <Checkbox
                    checked={isSelected(entry)}
                    className="pointer-events-none"
                  />
                  {entry.type === "directory" ? (
                    <Folder className="size-4 text-amber-500 shrink-0" />
                  ) : (
                    <File className="size-4 text-blue-500 shrink-0" />
                  )}
                  <span className="flex-1 truncate text-sm">{entry.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Paths Display */}
        {selectedPaths.size > 0 && (
          <div className="text-sm text-muted-foreground border-t pt-2">
            Selected: {selectedPaths.size} item(s)
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={selectedPaths.size === 0}>
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
