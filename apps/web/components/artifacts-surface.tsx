"use client"

import { type RunnerArtifactDetail } from "@/lib/runner"

export function ArtifactsSurface({
  artifact,
  loading,
}: {
  artifact: RunnerArtifactDetail | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--editor-bg)] p-8">
        <p className="text-sm text-muted-foreground">Loading artifact…</p>
      </div>
    )
  }

  if (!artifact) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--editor-bg)] p-8">
        <div className="max-w-md text-center">
          <h2 className="text-sm font-medium text-foreground">No artifact selected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select an artifact from the sidebar or Runner history to preview it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg)]">
      <div className="border-b border-border/70 bg-background px-6 py-4">
        <p className="text-sm font-medium text-foreground">{artifact.title}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{artifact.commandPath}</span>
          <span>{artifact.format}</span>
          <span>{new Date(artifact.createdAt).toLocaleString()}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{artifact.path}</p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {artifact.content}
        </pre>
      </div>
    </div>
  )
}
