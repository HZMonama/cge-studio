"use client"

import { ArrowSquareOutIcon, ClockIcon, ShieldWarningIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { type RunnerFindingDetail } from "@/lib/runner"

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-sky-500 text-white",
  info: "bg-zinc-500 text-white",
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-sky-400",
  info: "bg-zinc-400",
}

const AUTOMATION_LABELS: Record<string, string> = {
  auto_fixable: "Auto-fixable",
  semi_automated: "Semi-automated",
  manual: "Manual",
  design_change: "Design change",
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        SEVERITY_BADGE[severity] ?? "bg-zinc-500 text-white",
      )}
    >
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        status === "fail"
          ? "border-red-300/40 bg-red-500/10 text-red-400"
          : "border-amber-300/40 bg-amber-500/10 text-amber-400",
      )}
    >
      {status}
    </span>
  )
}

function DetailBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-border/60 px-6 py-5 last:border-0">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
        {title}
      </h3>
      {children}
    </section>
  )
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="mb-2 flex gap-3 text-sm last:mb-0">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 break-all text-foreground", mono && "font-mono text-xs")}>{value}</span>
    </div>
  )
}

export function FindingsSurface({
  finding,
  loading,
}: {
  finding: RunnerFindingDetail | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--editor-bg)] p-8">
        <p className="text-sm text-muted-foreground">Loading finding…</p>
      </div>
    )
  }

  if (!finding) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--editor-bg)] p-8">
        <div className="max-w-md text-center">
          <ShieldWarningIcon className="mx-auto mb-3 size-8 text-muted-foreground/30" />
          <h2 className="text-sm font-medium text-foreground">No finding selected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a finding from the sidebar to view its detail, evaluation context, and remediation guidance.
          </p>
        </div>
      </div>
    )
  }

  const tagsEntries = finding.resource?.tags
    ? Object.entries(finding.resource.tags)
    : []

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg)]">
      {/* Header */}
      <div className="border-b border-border/70 bg-background px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
          {finding.hasRemediation && (
            <span className="inline-flex items-center rounded border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              Remediation available
            </span>
          )}
        </div>
        <h1 className="mt-3 text-base font-semibold leading-snug text-foreground">
          {finding.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{finding.source}</span>
          {finding.controlFramework && finding.controlId && (
            <span>{finding.controlFramework} / {finding.controlId}</span>
          )}
          {finding.collectedAt && (
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3" />
              {new Date(finding.collectedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Resource */}
        <DetailBlock title="Resource">
          <FieldRow label="Type" value={finding.resource?.type} />
          <FieldRow label="ID" value={finding.resource?.id} mono />
          <FieldRow label="ARN / URI" value={finding.resource?.arn ?? finding.resource?.uri} mono />
          <FieldRow label="Region" value={finding.resource?.region} />
          <FieldRow label="Account" value={finding.resource?.account_id} mono />
          {tagsEntries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tagsEntries.map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center rounded border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
                >
                  {k}={v}
                </span>
              ))}
            </div>
          )}
        </DetailBlock>

        {/* Evaluation */}
        <DetailBlock title="Evaluation">
          <FieldRow label="Framework" value={finding.controlFramework} />
          <FieldRow label="Control" value={finding.controlId} mono />
          {finding.assessedAt && (
            <FieldRow label="Assessed at" value={new Date(finding.assessedAt).toLocaleString()} />
          )}
          {finding.message && (
            <p className="mt-3 rounded-md border border-border/50 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground">
              {finding.message}
            </p>
          )}
        </DetailBlock>

        {/* Remediation */}
        {finding.remediation && (
          <DetailBlock title="Remediation">
            {finding.remediation.summary && (
              <p className="mb-3 text-sm leading-relaxed text-foreground">
                {finding.remediation.summary}
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {finding.remediation.automation && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Automation</span>
                  <span className="text-foreground">
                    {AUTOMATION_LABELS[finding.remediation.automation] ?? finding.remediation.automation}
                  </span>
                </div>
              )}
              {finding.remediation.effort_hours != null && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Effort</span>
                  <span className="text-foreground">{finding.remediation.effort_hours}h</span>
                </div>
              )}
            </div>
            {finding.remediation.ref && (
              <div className="mt-3">
                <span className="text-xs text-muted-foreground">Reference</span>
                {finding.remediation.ref.startsWith("http") ? (
                  <a
                    href={finding.remediation.ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 break-all text-xs text-blue-400 hover:underline"
                  >
                    {finding.remediation.ref}
                    <ArrowSquareOutIcon className="size-3 shrink-0" />
                  </a>
                ) : (
                  <p className="mt-1 break-all font-mono text-xs text-foreground">
                    {finding.remediation.ref}
                  </p>
                )}
              </div>
            )}
          </DetailBlock>
        )}

        {/* Evidence & Context */}
        {(finding.evidenceRefs.length > 0 || finding.narrativeFindings.length > 0) && (
          <DetailBlock title="Evidence & Context">
            {finding.evidenceRefs.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Evidence refs</p>
                <ul className="space-y-1">
                  {finding.evidenceRefs.map((ref, i) => (
                    <li key={i} className="break-all font-mono text-xs text-foreground/80">
                      {ref}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {finding.narrativeFindings.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Narrative findings</p>
                <ul className="space-y-3">
                  {finding.narrativeFindings.map((nf) => (
                    <li
                      key={nf.id}
                      className="rounded-md border border-border/50 bg-muted/20 px-4 py-3"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-0.5 size-2 shrink-0 rounded-full",
                            SEVERITY_DOT[nf.severity] ?? "bg-zinc-400",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{nf.title}</p>
                          {nf.description && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {nf.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DetailBlock>
        )}

        {/* Source path */}
        <div className="px-6 pb-5 pt-2">
          <p className="break-all text-[10px] text-muted-foreground/40">{finding.documentPath}</p>
        </div>
      </div>
    </div>
  )
}
