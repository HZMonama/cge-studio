"use client"

import { useState } from "react"
import {
  ChartBarIcon,
  ClockCounterClockwiseIcon,
  CloudArrowUpIcon,
  FilePlusIcon,
  FileTextIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { MetricCard, type MetricCardStatus } from "@/components/metric-card"
import {
  type ConnectorSummary,
  type ProgramMetric,
  type ProgramSummary,
  type RunnerFindingSummary,
  type RunnerMetricsResponse,
} from "@/lib/runner"
import { cn } from "@/lib/utils"
import { type Plugin } from "@/lib/plugins"
import { useThemeStore } from "@/stores/theme-store"
import { usePluginPanel } from "@/stores/plugin-panel-store"

const EXPECTED_POAM_SOURCES: Array<
  Pick<ConnectorSummary, "id" | "label"> & { shortLabel: string }
> = [
  { id: "nessus", label: "Nessus", shortLabel: "NES" },
  { id: "qualys", label: "Qualys", shortLabel: "QUA" },
  { id: "tenable", label: "Tenable.io", shortLabel: "TEN" },
  { id: "wiz", label: "Wiz", shortLabel: "WIZ" },
]

const RUNNER_CONNECTOR_PLACEHOLDERS: Array<
  Pick<ConnectorSummary, "id" | "label"> & { shortLabel: string }
> = [
  { id: "aws-inspector", label: "AWS Inspector", shortLabel: "AWS" },
  { id: "gcp-inspector", label: "GCP Inspector", shortLabel: "GCP" },
  { id: "github-inspector", label: "GitHub Inspector", shortLabel: "GIT" },
  { id: "okta-inspector", label: "Okta Inspector", shortLabel: "OKTA" },
]

const EXPECTED_CONNECTOR_CARDS = [
  ...EXPECTED_POAM_SOURCES,
  ...RUNNER_CONNECTOR_PLACEHOLDERS,
].sort((left, right) => left.label.localeCompare(right.label))

function getConnectorIcon(connectorId: string, theme: "dark" | "light"): string | null {
  const icons: Record<string, { dark: string; light: string }> = {
    "aws-inspector": { dark: "/aws_dark.svg", light: "/aws_light.svg" },
    "gcp-inspector": { dark: "/google_cloud.svg", light: "/google_cloud.svg" },
    "github-inspector": { dark: "/github_dark.svg", light: "/github_light.svg" },
    "okta-inspector": { dark: "/okta_dark.png", light: "/okta_light.svg" },
  }

  return icons[connectorId]?.[theme] ?? null
}

function getConnectorPlaceholderLabel(connectorId: string) {
  return (
    EXPECTED_CONNECTOR_CARDS.find((connector) => connector.id === connectorId)?.shortLabel ??
    connectorId.slice(0, 3).toUpperCase()
  )
}

function isPoamSourceConnector(connectorId: string) {
  return EXPECTED_POAM_SOURCES.some((source) => source.id === connectorId)
}

function getConnectorPlugin(connectorId: string, plugins?: Plugin[]) {
  if (isPoamSourceConnector(connectorId)) {
    return plugins?.find((plugin) => plugin.id === "poam-automation")
  }

  return plugins?.find((plugin) => plugin.id === connectorId)
}

function MetricValue({
  detail,
  value,
}: {
  detail: string
  value: string | number
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function SummaryMetricCard({
  cardId,
  label,
  value,
  detail,
  expanded,
  Icon,
  onExpandedChange,
  status = "unknown",
}: {
  cardId: string
  label: string
  value: string | number
  detail: string
  expanded: boolean
  Icon: typeof ChartBarIcon
  onExpandedChange: (cardId: string, expanded: boolean) => void
  status?: MetricCardStatus
}) {
  return (
    <MetricCard
      expanded={expanded}
      icon={<Icon className="size-4" />}
      label={label}
      onExpandedChange={(next) => onExpandedChange(cardId, next)}
      status={status}
      footerAction={{ label: "See more" }}
    >
      <MetricValue value={value} detail={detail} />
    </MetricCard>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="px-6 py-4">
        <h2
          className="text-lg leading-none text-foreground"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function ConnectorCard({
  cardId,
  connector,
  expanded,
  onExpandedChange,
  plugin,
  onOpenPlugin,
}: {
  cardId: string
  connector: ConnectorSummary
  expanded: boolean
  onExpandedChange: (cardId: string, expanded: boolean) => void
  plugin?: Plugin
  onOpenPlugin?: (plugin: Plugin) => void
}) {
  const { theme } = useThemeStore()
  const iconSrc = getConnectorIcon(connector.id, theme)
  const status: MetricCardStatus = connector.configured ? "ok" : "error"
  const placeholderLabel = getConnectorPlaceholderLabel(connector.id)

  return (
    <MetricCard
      expanded={expanded}
      icon={
        iconSrc ? (
          <img src={iconSrc} alt="" className="size-5 object-contain" />
        ) : (
          <div
            className={cn(
              "flex size-5 items-center justify-center border text-[8px] font-semibold tracking-[0.12em]",
              theme === "dark"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-sky-500/30 bg-sky-500/10 text-sky-700",
            )}
          >
            {placeholderLabel}
          </div>
        )
      }
      label={connector.label}
      onExpandedChange={(next) => onExpandedChange(cardId, next)}
      status={status}
      footerAction={
        plugin
          ? {
              label: connector.configured ? "Open plugin" : "Configure",
              onClick: () => onOpenPlugin?.(plugin),
            }
          : undefined
      }
    >
      <div className="space-y-3">
        <MetricValue
          value={connector.findingsCached}
          detail={connector.configured ? "Cached findings" : "Connector is not configured"}
        />
        <div className="space-y-1.5 text-[10px] leading-4 text-muted-foreground">
          <div>
            <p className="uppercase tracking-[0.12em] text-muted-foreground/60">Connector ID</p>
            <p className="break-all font-mono text-foreground/70">{connector.id}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.12em] text-muted-foreground/60">Config path</p>
            <p className="break-all font-mono text-foreground/70">{connector.configPath}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.12em] text-muted-foreground/60">Cache path</p>
            <p className="break-all font-mono text-foreground/70">{connector.cachePath}</p>
          </div>
        </div>
      </div>
    </MetricCard>
  )
}

type MetricLike = ProgramMetric | RunnerMetricsResponse["current"][number]

function latestMetricById(metrics: MetricLike[], ids: string[]) {
  const wanted = new Set(ids)
  return metrics
    .filter((metric) => wanted.has(metric.metric_id))
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))[0]
}

function percent(part: number, total: number) {
  if (total === 0) return "0%"
  return `${Math.round((part / total) * 100)}%`
}

function average(values: number[]) {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export function MetricsSurface({
  connectors,
  findings,
  loading,
  metrics: materializedMetrics,
  onClearSnapshot,
  onOpenHistory,
  program,
  selectedSnapshotRecordedAt,
  selectedSnapshotId,
  workspaceName,
  plugins,
}: {
  connectors: ConnectorSummary[]
  findings: RunnerFindingSummary[]
  loading: boolean
  metrics: RunnerMetricsResponse | null
  onClearSnapshot?: () => void
  onOpenHistory: () => void
  program: ProgramSummary | null
  selectedSnapshotRecordedAt?: string | null
  selectedSnapshotId?: string | null
  workspaceName?: string | null
  plugins?: Plugin[]
}) {
  const { setSelectedPlugin } = usePluginPanel()
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const expectedConnectorIds = new Set(EXPECTED_CONNECTOR_CARDS.map((connector) => connector.id))
  const normalizedConnectors = [
    ...EXPECTED_CONNECTOR_CARDS.map((expected) => {
      const liveConnector = connectors.find((connector) => connector.id === expected.id)
      const isPoamSource = isPoamSourceConnector(expected.id)

      return liveConnector ?? {
        id: expected.id,
        label: expected.label,
        configured: false,
        findingsCached: 0,
        configPath: isPoamSource
          ? "~/.config/cge/connectors/poam-automation.yaml"
          : `~/.config/cge/connectors/${expected.id}.yaml`,
        cachePath: isPoamSource
          ? "~/.cache/cge/findings/poam-automation"
          : `~/.cache/cge/findings/${expected.id}`,
      }
    }),
    ...connectors.filter((connector) => !expectedConnectorIds.has(connector.id)),
  ].sort((left, right) => left.label.localeCompare(right.label))
  const metrics = [
    ...((materializedMetrics?.current ?? []) as MetricLike[]),
    ...(selectedSnapshotId ? [] : (program?.metrics ?? [])),
  ]
  const risks = program?.risks ?? []
  const controls = program?.controls ?? []
  const policies = program?.policies ?? []

  const cachedFindings = normalizedConnectors.reduce((sum, connector) => sum + connector.findingsCached, 0)
  const cachedFindingsMetric = latestMetricById(metrics, ["connector.cached_findings_count"])
  const openFindingsMetric = latestMetricById(metrics, ["findings.open_count"])
  const severeFindingsMetric = latestMetricById(metrics, ["findings.severe_count"])
  const openRisksMetric = latestMetricById(metrics, ["risk.open_count"])
  const residualRiskMetric = latestMetricById(metrics, ["risk.residual_score_avg"])
  const implementedControlsMetric = latestMetricById(metrics, ["control.implemented_percent"])
  const evidenceCoverageMetric = latestMetricById(metrics, ["evidence.coverage"])
  const activePoliciesMetric = latestMetricById(metrics, ["policy.active_percent"])
  const openFindings = findings.length
  const severeFindings = findings.filter((finding) =>
    finding.severity === "critical" || finding.severity === "high",
  ).length
  const implementedControls = controls.filter((control) =>
    ["active", "implemented", "passing", "pass", "monitored"].includes(control.status.toLowerCase()),
  ).length
  const openRisks = risks.filter((risk) => risk.status.toLowerCase() === "open").length
  const avgResidualRisk = average(
    risks
      .map((risk) => risk.residual?.score ?? risk.inherent?.score)
      .filter((score): score is number => typeof score === "number"),
  )
  const activePolicies = policies.filter((policy) => policy.status.toLowerCase() === "active").length
  const readinessMetric = latestMetricById(metrics, [
    "framework.readiness",
    "framework.readiness_score",
    "readiness_score",
  ])
  const evidenceMetric = latestMetricById(metrics, [
    "framework.evidence_coverage",
    "evidence.coverage",
    "evidence_coverage",
  ])
  const snapshotDateTime = selectedSnapshotRecordedAt
    ? new Date(selectedSnapshotRecordedAt).toLocaleString()
    : null

  function handleCardExpansion(cardId: string, expanded: boolean) {
    setExpandedCardId(expanded ? cardId : null)
  }

  if (loading) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[var(--editor-bg)] p-8">
        <p className="text-sm text-muted-foreground">Loading metrics...</p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg)]">
      <div className="flex h-(--row-h) min-h-(--row-h) max-h-(--row-h) shrink-0 items-center justify-between border-b border-border/70 bg-background px-6">
        <h1 className="min-w-0 truncate text-sm font-medium text-foreground">
          <span>{workspaceName ? `${workspaceName} Program Metrics` : "Program Metrics"}</span>
          {selectedSnapshotId && snapshotDateTime && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Snapshot {snapshotDateTime}
            </span>
          )}
          {selectedSnapshotId && !snapshotDateTime && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Snapshot
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {selectedSnapshotId && (
            <button
              className="h-8 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              onClick={onClearSnapshot}
            >
              Back to Current
            </button>
          )}
          <button
            className="group flex h-8 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            onClick={onOpenHistory}
          >
            <ClockCounterClockwiseIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
            History
          </button>
          <button
            className="group flex h-8 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            onClick={() => {
              const grcReporterPlugin = plugins?.find((p) => p.id === "grc-reporter")
              if (grcReporterPlugin) {
                setSelectedPlugin(grcReporterPlugin)
              } else {
                alert("GRC Reporter plugin not found")
              }
            }}
          >
            <FilePlusIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
            Create Report
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Section
          title="Posture"
          description="Core governance and implementation signals."
        >
          <div className="grid items-start gap-3 px-6 pb-6 pt-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryMetricCard
              cardId="summary.readiness"
              expanded={expandedCardId === "summary.readiness"}
              Icon={ChartBarIcon}
              label="Readiness"
              onExpandedChange={handleCardExpansion}
              value={readinessMetric ? `${readinessMetric.value}${readinessMetric.unit ?? ""}` : "N/A"}
              detail={readinessMetric?.subject ?? "Awaiting framework metric output"}
              status={readinessMetric ? "ok" : "unknown"}
            />
            <SummaryMetricCard
              cardId="summary.evidence"
              expanded={expandedCardId === "summary.evidence"}
              Icon={ShieldCheckIcon}
              label="Evidence"
              onExpandedChange={handleCardExpansion}
              value={
                evidenceMetric
                  ? `${evidenceMetric.value}${evidenceMetric.unit ?? ""}`
                  : evidenceCoverageMetric
                    ? `${evidenceCoverageMetric.value}${evidenceCoverageMetric.unit === "percent" ? "%" : ""}`
                    : "N/A"
              }
              detail={evidenceMetric?.subject ?? evidenceCoverageMetric?.sourceRef ?? "Awaiting evidence metric output"}
              status={evidenceMetric || evidenceCoverageMetric ? "ok" : "unknown"}
            />
            <SummaryMetricCard
              cardId="summary.controls"
              expanded={expandedCardId === "summary.controls"}
              Icon={ShieldCheckIcon}
              label="Controls"
              onExpandedChange={handleCardExpansion}
              value={implementedControlsMetric ? `${implementedControlsMetric.value}%` : percent(implementedControls, controls.length)}
              detail={implementedControlsMetric?.sourceRef ?? `${implementedControls}/${controls.length} implemented`}
              status={controls.length === 0 && !implementedControlsMetric ? "unknown" : (implementedControlsMetric?.value ?? implementedControls) === (implementedControlsMetric ? 100 : controls.length) ? "ok" : "warn"}
            />
            <SummaryMetricCard
              cardId="summary.policies"
              expanded={expandedCardId === "summary.policies"}
              Icon={FileTextIcon}
              label="Policies"
              onExpandedChange={handleCardExpansion}
              value={activePoliciesMetric ? `${activePoliciesMetric.value}%` : percent(activePolicies, policies.length)}
              detail={activePoliciesMetric?.sourceRef ?? `${activePolicies}/${policies.length} active`}
              status={policies.length === 0 && !activePoliciesMetric ? "unknown" : (activePoliciesMetric?.value ?? activePolicies) === (activePoliciesMetric ? 100 : policies.length) ? "ok" : "warn"}
            />
          </div>
        </Section>

        <Section
          title="Exposure"
          description="Immediate unresolved risk and finding pressure."
        >
          <div className="grid items-start gap-3 px-6 pb-6 pt-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryMetricCard
              cardId="summary.open-findings"
              expanded={expandedCardId === "summary.open-findings"}
              Icon={WarningCircleIcon}
              label="Open Findings"
              onExpandedChange={handleCardExpansion}
              value={openFindingsMetric?.value ?? openFindings}
              detail={`${cachedFindingsMetric?.value ?? cachedFindings} cached across configured connectors`}
              status={(openFindingsMetric?.value ?? openFindings) === 0 ? "ok" : "warn"}
            />
            <SummaryMetricCard
              cardId="summary.severe-findings"
              expanded={expandedCardId === "summary.severe-findings"}
              Icon={WarningCircleIcon}
              label="Severe Findings"
              onExpandedChange={handleCardExpansion}
              value={severeFindingsMetric?.value ?? severeFindings}
              detail="Critical and high severity findings"
              status={(severeFindingsMetric?.value ?? severeFindings) === 0 ? "ok" : "warn"}
            />
            <SummaryMetricCard
              cardId="summary.open-risks"
              expanded={expandedCardId === "summary.open-risks"}
              Icon={WarningCircleIcon}
              label="Open Risks"
              onExpandedChange={handleCardExpansion}
              value={openRisksMetric?.value ?? openRisks}
              detail={`${risks.length} total risks tracked`}
              status={(openRisksMetric?.value ?? openRisks) === 0 ? "ok" : "warn"}
            />
            <SummaryMetricCard
              cardId="summary.residual-risk"
              expanded={expandedCardId === "summary.residual-risk"}
              Icon={ChartBarIcon}
              label="Residual Risk"
              onExpandedChange={handleCardExpansion}
              value={residualRiskMetric?.value ?? avgResidualRisk ?? "N/A"}
              detail={residualRiskMetric?.sourceRef ?? (avgResidualRisk == null ? "No residual score yet" : "Average residual risk score")}
              status={residualRiskMetric == null && avgResidualRisk == null ? "unknown" : (residualRiskMetric?.value ?? avgResidualRisk) === 0 ? "ok" : "warn"}
            />
          </div>
        </Section>

        <Section
          title="Connectors"
          description="POA&M automation source availability and cached finding inventory."
        >
          <div className="grid items-start gap-3 px-6 pb-6 pt-3 md:grid-cols-2 xl:grid-cols-4">
            {normalizedConnectors.map((connector) => (
              <ConnectorCard
                cardId={`connector.${connector.id}`}
                key={connector.id}
                connector={connector}
                expanded={expandedCardId === `connector.${connector.id}`}
                onExpandedChange={handleCardExpansion}
                plugin={getConnectorPlugin(connector.id, plugins)}
                onOpenPlugin={setSelectedPlugin}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
