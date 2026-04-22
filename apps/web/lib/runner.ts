import { type Plugin } from "@/lib/plugins"

const RUNNER_BASE_URL = process.env.NEXT_PUBLIC_RUNNER_URL ?? "http://127.0.0.1:3333"

interface PluginRegistryResponse {
  plugins: Plugin[]
  source: string
  toolkitPath: string | null
}

export interface RunnerWorkspace {
  id: string
  name: string
  title: string
  rootPath: string
  createdAt: string | null
  updatedAt: string | null
  folders: {
    dataRoot: string
    runner: string
    runs: string
    findings: string
    program: string
    artifacts: string
    artifactsGenerated: string
    artifactsExports: string
    artifactsBundles: string
    dashboards: string
  }
}

export interface RunnerHealthSnapshot {
  ok: boolean
  runnerVersion: string
  toolkitPath: string | null
  toolkitConfigured: boolean
  runnerConfigPath: string | null
  appDataRoot: string
  cacheRoot: string
  configRoot: string
  workspacesRoot: string
}

export interface RunnerConfigSnapshot {
  toolkitPath: string
  workspaceRoot: string
  runnerConfigPath: string
}

export interface ConnectorSummary {
  id: string
  label: string
  configured: boolean
  findingsCached: number
  configPath: string
  cachePath: string
}

export interface RunnerArtifactSummary {
  id: string
  runId: string
  title: string
  kind: string
  format: "markdown" | "json" | "text"
  path: string
  createdAt: string
  commandPath: string
  pluginId: string
  commandId: string
}

export interface RunnerArtifactDetail extends RunnerArtifactSummary {
  content: string
}

export interface RunnerRunEvent {
  id: string
  type:
    | "run.created"
    | "run.started"
    | "message"
    | "prompt.required"
    | "tool.started"
    | "tool.stdout"
    | "tool.stderr"
    | "tool.completed"
    | "artifact.created"
    | "run.completed"
    | "run.failed"
  createdAt: string
  data: Record<string, unknown>
}

export interface RunnerRun {
  id: string
  status: "planned" | "running" | "completed" | "failed"
  createdAt: string
  completedAt?: string | null
  prompt?: string
  commandPath?: string
  pluginId?: string
  commandId?: string
  executionMode?: "script" | "workflow"
  outputDir: string
  commandPreview: string | null
  artifactCount?: number
  artifacts: RunnerArtifactSummary[]
}

export interface ClaudeCodeStatus {
  installed: boolean
  version: string | null
  apiKeyConfigured: boolean
  subscriptionLoginConfigured: boolean
  model: string | null
  settingsPath: string
}

export interface WorkspaceExportSummary {
  workspace: RunnerWorkspace
  exportedAt: string
  summary: {
    runs: number
    artifacts: number
  }
}

export async function fetchClaudeCodeStatus(signal?: AbortSignal): Promise<ClaudeCodeStatus | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/claude-code/status`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) return null
    return (await response.json()) as ClaudeCodeStatus
  } catch {
    return null
  }
}

export async function updateClaudeCodeConfig(
  input: Partial<Pick<ClaudeCodeStatus, "model">>,
): Promise<ClaudeCodeStatus | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/claude-code/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!response.ok) return null
    return (await response.json()) as ClaudeCodeStatus
  } catch {
    return null
  }
}

export async function fetchPluginRegistry(signal?: AbortSignal): Promise<Plugin[] | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/registry/plugins`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as PluginRegistryResponse
    return Array.isArray(payload.plugins) && payload.plugins.length > 0
      ? payload.plugins
      : null
  } catch {
    return null
  }
}

export async function fetchRunnerHealth(signal?: AbortSignal): Promise<RunnerHealthSnapshot | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/health`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerHealthSnapshot
  } catch {
    return null
  }
}

export async function fetchRunnerConfig(signal?: AbortSignal): Promise<RunnerConfigSnapshot | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/config`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerConfigSnapshot
  } catch {
    return null
  }
}

export async function updateRunnerConfig(
  input: Partial<Pick<RunnerConfigSnapshot, "toolkitPath">>,
): Promise<RunnerConfigSnapshot | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerConfigSnapshot
  } catch {
    return null
  }
}

export async function fetchConnectors(signal?: AbortSignal): Promise<ConnectorSummary[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/connectors`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return []
    }

    return (await response.json()) as ConnectorSummary[]
  } catch {
    return []
  }
}

export async function fetchWorkspaces(signal?: AbortSignal): Promise<RunnerWorkspace[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return []
    }

    return (await response.json()) as RunnerWorkspace[]
  } catch {
    return []
  }
}

export async function createWorkspace(input: {
  title?: string
}): Promise<RunnerWorkspace | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerWorkspace
  } catch {
    return null
  }
}

export async function renameWorkspace(workspaceId: string, title: string): Promise<RunnerWorkspace | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerWorkspace
  } catch {
    return null
  }
}

export async function refreshWorkspace(workspaceId: string): Promise<RunnerWorkspace | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/refresh`, {
      method: "POST",
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerWorkspace
  } catch {
    return null
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}`, {
      method: "DELETE",
    })

    return response.ok
  } catch {
    return false
  }
}

export async function exportWorkspace(workspaceId: string): Promise<WorkspaceExportSummary | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/export`, {
      cache: "no-store",
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as WorkspaceExportSummary
  } catch {
    return null
  }
}

export async function fetchRuns(workspaceId: string, signal?: AbortSignal): Promise<RunnerRun[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return []
    }

    return (await response.json()) as RunnerRun[]
  } catch {
    return []
  }
}

export async function createRun(workspaceId: string, prompt: string): Promise<RunnerRun | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, workspaceId }),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerRun
  } catch {
    return null
  }
}

export async function fetchArtifacts(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<RunnerArtifactSummary[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/artifacts`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return []
    }

    return (await response.json()) as RunnerArtifactSummary[]
  } catch {
    return []
  }
}

export async function fetchRunEvents(
  workspaceId: string,
  runId: string,
  signal?: AbortSignal,
): Promise<RunnerRunEvent[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs/${runId}/events`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return []
    }

    return (await response.json()) as RunnerRunEvent[]
  } catch {
    return []
  }
}

export async function respondToRunPrompt(
  workspaceId: string,
  runId: string,
  answers: Record<string, string>,
): Promise<RunnerRun | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs/${runId}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answers }),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerRun
  } catch {
    return null
  }
}

export async function fetchArtifactDetail(
  workspaceId: string,
  artifactId: string,
  signal?: AbortSignal,
): Promise<RunnerArtifactDetail | null> {
  try {
    const response = await fetch(
      `${RUNNER_BASE_URL}/workspaces/${workspaceId}/artifacts/${artifactId}/content`,
      {
        cache: "no-store",
        signal,
      },
    )

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerArtifactDetail
  } catch {
    return null
  }
}
