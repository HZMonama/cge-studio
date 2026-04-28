"use client"

import { useCallback, useEffect, useState } from "react"
import { RUNNER_BASE_URL } from "@/lib/runner"
import type { FsListing, FsEntry } from "@/lib/file-system"

interface UseFileSystemOptions {
  showHidden?: boolean
}

interface UseFileSystemReturn {
  homePath: string | null
  currentPath: string
  entries: FsEntry[]
  loading: boolean
  error: string | null
  setPath: (path: string) => void
  refresh: () => void
  createDirectory: (name: string) => Promise<boolean>
}

export function useFileSystem(options: UseFileSystemOptions = {}): UseFileSystemReturn {
  const { showHidden = false } = options
  const [homePath, setHomePath] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState<string>("")
  const [entries, setEntries] = useState<FsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch home directory on mount
  useEffect(() => {
    fetch(`${RUNNER_BASE_URL}/fs/home`)
      .then((res) => res.json())
      .then((data) => {
        setHomePath(data.path)
        if (!currentPath) {
          setCurrentPath(data.path)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch home directory:", err)
        setError("Failed to initialize file system")
      })
  }, [])

  // Fetch directory listing when path changes
  const fetchListing = useCallback(async () => {
    if (!currentPath) return

    setLoading(true)
    setError(null)

    try {
      const query = new URLSearchParams({
        path: currentPath,
        showHidden: String(showHidden),
      })
      const res = await fetch(`${RUNNER_BASE_URL}/fs/ls?${query}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to list directory")
      }

      setEntries(data.entries)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [currentPath, showHidden])

  useEffect(() => {
    fetchListing()
  }, [fetchListing])

  const createDirectory = useCallback(
    async (name: string): Promise<boolean> => {
      try {
        const newPath = `${currentPath}/${name}`.replace(/\/+/g, "/")
        const res = await fetch(`${RUNNER_BASE_URL}/fs/mkdir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: newPath }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to create directory")
        }

        // Refresh listing after creation
        await fetchListing()
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        return false
      }
    },
    [currentPath, fetchListing]
  )

  return {
    homePath,
    currentPath,
    entries,
    loading,
    error,
    setPath: setCurrentPath,
    refresh: fetchListing,
    createDirectory,
  }
}
