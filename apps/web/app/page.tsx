"use client"

import { useEffect, useState } from "react"
import { ChartBarIcon, FilesIcon, FolderNotchOpenIcon, LightningIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"

import { AppSidebar } from "@/components/app-sidebar"
import { AppShellHeader, type AppHeaderSection, type SyncStatus } from "@/components/app-shell-header"
import { ArtifactsSurface } from "@/components/artifacts-surface"
import { ChatSurface } from "@/components/chat-surface"
import { ConfigPanel } from "@/components/config-panel"
import { PluginPanel } from "@/components/plugin-panel"
import { RunnerHistoryPanel } from "@/components/runner-history-panel"
import { SectionSurface } from "@/components/section-surface"
import { WorkspaceFooter } from "@/components/workspace-footer"
import { FALLBACK_PLUGINS, type Plugin } from "@/lib/plugins"
import {
  createRun,
  fetchArtifactDetail,
  fetchArtifacts,
  fetchPluginRegistry,
  fetchRunnerHealth,
  fetchRuns,
  type RunnerArtifactDetail,
  type RunnerArtifactSummary,
  type RunnerRun,
} from "@/lib/runner"
import { usePluginPanel } from "@/stores/plugin-panel-store"

interface Workspace {
  id: string
  title: string
}

type AppSection = "chat" | "dashboards" | "findings" | "program" | "artifacts"

const HEADER_SECTIONS: AppHeaderSection[] = [
  { id: "chat", label: "Runner", Icon: LightningIcon },
  { id: "dashboards", label: "Dashboards", Icon: ChartBarIcon },
  { id: "findings", label: "Findings", Icon: MagnifyingGlassIcon },
  { id: "program", label: "Program", Icon: FolderNotchOpenIcon },
  { id: "artifacts", label: "Artifacts", Icon: FilesIcon },
]

function newWorkspace(): Workspace {
  return { id: crypto.randomUUID(), title: "Untitled" }
}

export default function Page() {
  const { openHistory } = usePluginPanel()
  const [initialWorkspace] = useState<Workspace>(() => newWorkspace())
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => [initialWorkspace])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(initialWorkspace.id)
  const [activeSection, setActiveSection] = useState<AppSection>("chat")
  const [plugins, setPlugins] = useState<Plugin[]>(FALLBACK_PLUGINS)
  const [runs, setRuns] = useState<RunnerRun[]>([])
  const [artifacts, setArtifacts] = useState<RunnerArtifactSummary[]>([])
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)
  const [selectedArtifact, setSelectedArtifact] = useState<RunnerArtifactDetail | null>(null)
  const [artifactLoading, setArtifactLoading] = useState(false)
  const [runPending, setRunPending] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("fallback")
  const [composerFocusToken, setComposerFocusToken] = useState(0)
  const [composerPrompt, setComposerPrompt] = useState("")
  const [sidebarFocusSearchToken, setSidebarFocusSearchToken] = useState(0)
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? workspaces[0]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === "s") {
        event.preventDefault()
        setSidebarFocusSearchToken(prev => prev + 1)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetchRunnerHealth(controller.signal).then((health) => {
      if (!health) {
        setSyncStatus("offline")
        return
      }

      setSyncStatus(health.toolkitConfigured ? "synced" : "fallback")
    })

    fetchPluginRegistry(controller.signal).then((registry) => {
      if (registry) {
        setPlugins(registry)
      }
    })

    fetchRuns(controller.signal).then(setRuns)
    fetchArtifacts(controller.signal).then((items) => {
      setArtifacts(items)
      setSelectedArtifactId((current) => current ?? items[0]?.id ?? null)
    })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedArtifactId) {
      setSelectedArtifact(null)
      return
    }

    const controller = new AbortController()
    setArtifactLoading(true)

    fetchArtifactDetail(selectedArtifactId, controller.signal)
      .then((artifact) => {
        setSelectedArtifact(artifact)
      })
      .finally(() => {
        setArtifactLoading(false)
      })

    return () => controller.abort()
  }, [selectedArtifactId])

  function insertComposerCommand(path: string) {
    setActiveSection("chat")
    setComposerPrompt(`${path} `)
    setComposerFocusToken(prev => prev + 1)
  }

  async function refreshRunnerData() {
    const [nextRuns, nextArtifacts] = await Promise.all([
      fetchRuns(),
      fetchArtifacts(),
    ])

    setRuns(nextRuns)
    setArtifacts(nextArtifacts)
    setSelectedArtifactId((current) => (
      current && nextArtifacts.some((artifact) => artifact.id === current)
        ? current
        : nextArtifacts[0]?.id ?? null
    ))
  }

  async function runComposerCommand() {
    const prompt = composerPrompt.trim()
    if (!/^\/[a-z0-9-]+:[a-z0-9-]+/i.test(prompt)) {
      return
    }

    setRunPending(true)
    let run: RunnerRun | null = null

    try {
      run = await createRun(prompt)
      await refreshRunnerData()
    } finally {
      setRunPending(false)
    }

    if (run?.artifacts?.[0]?.id) {
      setSelectedArtifactId(run.artifacts[0].id)
      openHistory()
    }
  }

  function addWorkspace() {
    const workspace = newWorkspace()
    setWorkspaces(prev => [...prev, workspace])
    setActiveWorkspaceId(workspace.id)
  }

  function closeWorkspace(id: string) {
    setWorkspaces(prev => {
      if (prev.length === 1) return prev
      const idx = prev.findIndex(workspace => workspace.id === id)
      const next = prev.filter(workspace => workspace.id !== id)
      if (activeWorkspaceId === id) setActiveWorkspaceId(next[Math.max(0, idx - 1)].id)
      return next
    })
  }

  function renameActiveWorkspace() {
    const nextTitle = window.prompt("Rename workspace", activeWorkspace.title)
    const title = nextTitle?.trim()
    if (!title) return

    setWorkspaces(prev => prev.map(workspace => (
      workspace.id === activeWorkspace.id ? { ...workspace, title } : workspace
    )))
  }

  return (
    <div className="flex min-h-svh bg-sidebar">
      <AppSidebar
        activeSection={activeSection}
        artifacts={artifacts}
        focusSearchToken={sidebarFocusSearchToken}
        onSelectArtifact={(artifactId) => {
          setActiveSection("artifacts")
          setSelectedArtifactId(artifactId)
        }}
        plugins={plugins}
        selectedArtifactId={selectedArtifactId}
      />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <AppShellHeader
          activeSection={activeSection}
          onSelectSection={(section) => setActiveSection(section as AppSection)}
          sections={HEADER_SECTIONS}
          syncStatus={syncStatus}
        />

        {activeSection === "chat" && (
          <ChatSurface
            focusToken={composerFocusToken}
            onOpenHistory={openHistory}
            onRun={runComposerCommand}
            plugins={plugins}
            prompt={composerPrompt}
            runPending={runPending}
            setPrompt={setComposerPrompt}
          />
        )}
        {activeSection === "dashboards" && (
          <SectionSurface
            title="Dashboards"
            description="Dashboard views will live here once the specialized monitoring surfaces are wired in."
          />
        )}
        {activeSection === "findings" && (
          <SectionSurface
            title="Findings"
            description="Structured findings will live here once the findings explorer and remediation links are wired in."
          />
        )}
        {activeSection === "program" && (
          <SectionSurface
            title="Program"
            description="Program state, risks, and operational records will live here as a dedicated interface."
          />
        )}
        {activeSection === "artifacts" && (
          <ArtifactsSurface
            artifact={selectedArtifact}
            loading={artifactLoading}
          />
        )}

        <WorkspaceFooter
          activeWorkspaceId={activeWorkspaceId}
          onAddWorkspace={addWorkspace}
          onCloseWorkspace={closeWorkspace}
          onRenameWorkspace={renameActiveWorkspace}
          setActiveWorkspaceId={setActiveWorkspaceId}
          workspaces={workspaces}
        />
      </main>

      <PluginPanel
        onSelectCommand={(pluginId, command) => {
          insertComposerCommand(`/${pluginId}:${command.id}`)
        }}
      />
      <RunnerHistoryPanel
        onSelectArtifact={(artifactId) => {
          setSelectedArtifactId(artifactId)
          setActiveSection("artifacts")
        }}
        runs={runs}
      />
      <ConfigPanel />
    </div>
  )
}
