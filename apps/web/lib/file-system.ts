export interface FsEntry {
  name: string
  type: "file" | "directory"
  size: number | null
}

export interface FsListing {
  path: string
  entries: FsEntry[]
}

export interface FilePickerOptions {
  pathType?: "file" | "directory" | "any"
  allowMultiple?: boolean
  initialPath?: string
  showHidden?: boolean
}

export function joinPath(base: string, ...parts: string[]): string {
  // Simple path join that works for Unix paths
  const allParts = [base.replace(/\/$/, ""), ...parts]
  return allParts.join("/")
}

export function getParentPath(currentPath: string): string | null {
  if (currentPath === "/" || currentPath === "") return null
  const parts = currentPath.split("/").filter(Boolean)
  parts.pop()
  if (parts.length === 0) return "/"
  return "/" + parts.join("/")
}

export function getEntryPath(parentPath: string, entryName: string): string {
  return joinPath(parentPath, entryName)
}
