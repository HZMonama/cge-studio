import { type Plugin, type Command, getRunnerSupport } from "@/lib/plugins"

export const RUNNER_BASE_URL = process.env.NEXT_PUBLIC_RUNNER_URL ?? "/api/runner"

interface PluginRegistryResponse {
  plugins: Plugin[]
  source: string
  toolkitPath: string | null
  format?: "v2" | "v1"  // Phase 3: v2 format from simplified runner
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
    programControls?: string
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
  format: "markdown" | "json" | "yaml" | "text"
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
    | "run.canceled"
    | "run.failed"
  createdAt: string
  data: Record<string, unknown>
}

export interface RunnerRun {
  id: string
  status: "planned" | "pending" | "running" | "completed" | "failed" | "canceled"
  createdAt: string
  completedAt?: string | null
  prompt?: string
  commandPath?: string
  pluginId?: string
  commandId?: string
  executionMode?: "script" | "workflow" | "unsupported"
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

export interface CodexStatus {
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

export async function fetchCodexStatus(signal?: AbortSignal): Promise<CodexStatus | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/codex/status`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) return null
    return (await response.json()) as CodexStatus
  } catch {
    return null
  }
}

export async function updateCodexConfig(
  input: Partial<Pick<CodexStatus, "model">>,
): Promise<CodexStatus | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/codex/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!response.ok) return null
    return (await response.json()) as CodexStatus
  } catch {
    return null
  }
}

/**
 * Process commands from v2 format to ensure all have proper runtime info
 * Commands without schema.yaml (not yet migrated) are marked as "planned"
 */
function processV2Commands(commands: Command[]): Command[] {
  return commands.map((cmd) => {
    // Trust the runner's runtime.runnerSupport if it exists (v2 format)
    // The runner already validates schemas and sets this correctly
    const runnerSupport = getRunnerSupport(cmd)
    
    return {
      ...cmd,
      // Ensure runtime field exists
      runtime: cmd.runtime || {
        executionMode: cmd.execution?.mode || "agent",
        runnerSupport,
      },
      // Copy runtime support to legacy field for backward compatibility
      runnerSupport,
      // Ensure uiHint exists
      uiHint: cmd.ui?.category as Command["uiHint"] || cmd.uiHint,
    }
  })
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
    
    if (!Array.isArray(payload.plugins)) {
      return null
    }
    
    // Phase 3: Handle v2 format from simplified runner
    if (payload.format === "v2") {
      const processedPlugins = payload.plugins.map((plugin) => ({
        ...plugin,
        commands: processV2Commands(plugin.commands),
      }))
      return processedPlugins.length > 0 ? processedPlugins : null
    }
    
    // Legacy v1 format
    return payload.plugins.length > 0 ? payload.plugins : null
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

export async function fetchRuns(workspaceId: string, signal?: AbortSignal): Promise<RunnerRun[] | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerRun[]
  } catch {
    return null
  }
}

export async function createRun(
  workspaceId: string,
  prompt: string,
  redactedPrompt?: string,
): Promise<RunnerRun | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, redactedPrompt, workspaceId }),
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

export class RunnerPromptError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RunnerPromptError";
  }
}

export async function respondToRunPrompt(
  workspaceId: string,
  runId: string,
  promptId: string,
  answers: Record<string, string>,
): Promise<RunnerRun | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs/${runId}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ promptId, answers }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({} as Record<string, unknown>));
      const errorCode = typeof body.error === "string" ? body.error : "unknown_error";
      const errorMessage = typeof body.message === "string" ? body.message : "The workflow input could not be submitted.";

      if (response.status === 400 && errorCode === "run_not_waiting_for_input") {
        throw new RunnerPromptError(errorCode, "This prompt was already answered and the workflow is running.");
      }

      throw new RunnerPromptError(errorCode, errorMessage);
    }

    return (await response.json()) as RunnerRun
  } catch (error) {
    if (error instanceof RunnerPromptError) {
      throw error;
    }
    return null
  }
}

export async function cancelRun(
  workspaceId: string,
  runId: string,
): Promise<RunnerRun | null> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/runs/${runId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as RunnerRun
  } catch {
    return null
  }
}

export interface RunnerFindingSummary {
  id: string
  title: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  status: "fail" | "inconclusive"
  source: string
  resourceType: string | null
  resourceId: string | null
  resourceRegion: string | null
  accountId: string | null
  controlFramework: string | null
  controlId: string | null
  message: string | null
  collectedAt: string | null
  assessedAt: string | null
  hasRemediation: boolean
}

export interface RunnerFindingResource {
  type: string
  id: string
  arn?: string | null
  uri?: string | null
  region?: string | null
  account_id?: string | null
  tags?: Record<string, string>
}

export interface RunnerFindingRemediation {
  summary?: string
  ref?: string
  effort_hours?: number
  automation?: "auto_fixable" | "semi_automated" | "manual" | "design_change"
}

export interface RunnerNarrativeFinding {
  id: string
  title: string
  severity: string
  description?: string
  related_control_ids?: string[]
  related_resource_ids?: string[]
}

export interface RunnerFindingDetail extends RunnerFindingSummary {
  resource: RunnerFindingResource
  remediation: RunnerFindingRemediation | null
  evidenceRefs: string[]
  rawAttributes: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  narrativeFindings: RunnerNarrativeFinding[]
  documentPath: string
}

export async function fetchFindings(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<RunnerFindingSummary[]> {
  try {
    const response = await fetch(`${RUNNER_BASE_URL}/workspaces/${workspaceId}/findings`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) return []
    return (await response.json()) as RunnerFindingSummary[]
  } catch {
    return []
  }
}

export async function fetchFindingDetail(
  workspaceId: string,
  findingId: string,
  signal?: AbortSignal,
): Promise<RunnerFindingDetail | null> {
  try {
    const response = await fetch(
      `${RUNNER_BASE_URL}/workspaces/${workspaceId}/findings/${encodeURIComponent(findingId)}`,
      { cache: "no-store", signal },
    )
    if (!response.ok) return null
    return (await response.json()) as RunnerFindingDetail
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

export interface ProgramRisk {
  schema_version?: string
  risk_id: string
  title: string
  status: string
  owner?: string | null
  treatment?: string | null
  created_at?: string | null
  updated_at?: string | null
  inherent?: { likelihood?: number; impact?: number; score?: number }
  residual?: { likelihood?: number; impact?: number; score?: number }
  linked_findings?: string[]
  linked_controls?: string[]
  tags?: string[]
}

export interface ProgramMetric {
  schema_version?: string
  metric_id: string
  recorded_at: string
  value: number
  unit?: string | null
  subject?: string | null
  source?: "workspace" | "command" | string | null
  sourceRef?: string | null
  runId?: string | null
  dimensions?: Record<string, unknown> | null
  window?: string | null
}

export interface RunnerMetricRecord {
  schema_version: string
  metric_id: string
  recorded_at: string
  value: number
  unit: string | null
  subject: string | null
  source: "workspace" | "command"
  sourceRef: string | null
  runId: string | null
  dimensions: Record<string, unknown> | null
  window: string | null
}

export interface RunnerMetricSnapshotSummary {
  snapshot_id: string
  recorded_at: string
  metric_count: number
}

export interface RunnerMetricSnapshot extends RunnerMetricSnapshotSummary {
  schema_version: string
  workspace_id: string
  metrics: RunnerMetricRecord[]
}

export interface RunnerMetricsResponse {
  current: RunnerMetricRecord[]
  snapshots: RunnerMetricSnapshotSummary[]
}

export interface ProgramException {
  schema_version?: string
  exception_id: string
  control_id: string
  control_framework: string
  status: string
  rationale: string
  owner: string
  created_at: string
  expires_at?: string | null
  compensating_controls?: string[]
}

export interface ProgramVendor {
  schema_version?: string
  vendor_id: string
  name: string
  tier: string
  status: string
  owner?: string | null
  last_review_at?: string | null
  next_review_at?: string | null
  risks?: string[]
}

export interface ProgramPolicy {
  schema_version?: string
  policy_id: string
  title: string
  status: string
  version: string
  owner: string
  document_path: string
  effective_at?: string | null
  next_review_at?: string | null
  framework_refs?: string[]
  control_refs?: string[]
}

export interface ProgramControl {
  schema_version?: string
  control_id: string
  title: string
  status: string
  owner?: string | null
  framework_refs?: string[]
  policy_refs?: string[]
  evidence_refs?: string[]
  automation_status?: string | null
  last_tested_at?: string | null
  next_test_at?: string | null
}

export interface ProgramSummary {
  risks: ProgramRisk[]
  metrics: ProgramMetric[]
  exceptions: ProgramException[]
  vendors: ProgramVendor[]
  policies: ProgramPolicy[]
  controls: ProgramControl[]
}

export async function fetchProgram(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<ProgramSummary | null> {
  try {
    const response = await fetch(
      `${RUNNER_BASE_URL}/workspaces/${workspaceId}/program`,
      { cache: "no-store", signal },
    )
    if (!response.ok) return null
    return (await response.json()) as ProgramSummary
  } catch {
    return null
  }
}

export async function fetchMetrics(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<RunnerMetricsResponse | null> {
  try {
    const response = await fetch(
      `${RUNNER_BASE_URL}/workspaces/${workspaceId}/metrics`,
      { cache: "no-store", signal },
    )
    if (!response.ok) return null
    return (await response.json()) as RunnerMetricsResponse
  } catch {
    return null
  }
}

export async function fetchMetricSnapshot(
  workspaceId: string,
  snapshotId: string,
  signal?: AbortSignal,
): Promise<RunnerMetricSnapshot | null> {
  try {
    const response = await fetch(
      `${RUNNER_BASE_URL}/workspaces/${workspaceId}/metrics/snapshots/${encodeURIComponent(snapshotId)}`,
      { cache: "no-store", signal },
    )
    if (!response.ok) return null
    return (await response.json()) as RunnerMetricSnapshot
  } catch {
    return null
  }
}
