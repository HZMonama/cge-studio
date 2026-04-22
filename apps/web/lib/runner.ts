import { type Plugin } from "@/lib/plugins"

const RUNNER_BASE_URL = process.env.NEXT_PUBLIC_RUNNER_URL ?? "http://127.0.0.1:3333"

interface PluginRegistryResponse {
  plugins: Plugin[]
  source: string
  toolkitPath: string | null
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

export interface RunnerRun {
  id: string
  status: "planned" | "running" | "completed" | "failed"
  createdAt: string
  completedAt?: string | null
  prompt?: string
  commandPath?: string
  pluginId?: string
  commandId?: string
  outputDir: string
  commandPreview: string | null
  artifactCount?: number
  artifacts: RunnerArtifactSummary[]
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

export async function fetchRuns(signal?: AbortSignal): Promise<RunnerRun[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/runs`, {
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

export async function createRun(prompt: string): Promise<RunnerRun | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerRun
  } catch {
    return null
  }
}

export async function fetchArtifacts(signal?: AbortSignal): Promise<RunnerArtifactSummary[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/artifacts`, {
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

export async function fetchArtifactDetail(
  artifactId: string,
  signal?: AbortSignal,
): Promise<RunnerArtifactDetail | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/artifacts/${artifactId}/content`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerArtifactDetail
  } catch {
    return null
  }
}
