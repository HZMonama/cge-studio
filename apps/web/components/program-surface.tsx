"use client"

import { useState } from "react"
import {
  ShieldCheckIcon,
  ShieldWarningIcon,
  UsersIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import {
  type ProgramException,
  type ProgramMetric,
  type ProgramPolicy,
  type ProgramRisk,
  type ProgramSummary,
  type ProgramVendor,
} from "@/lib/runner"

type ProgramTab = "risks" | "exceptions" | "vendors" | "policies" | "metrics"

const TABS: { id: ProgramTab; label: string }[] = [
  { id: "risks", label: "Risks" },
  { id: "exceptions", label: "Exceptions" },
  { id: "vendors", label: "Vendors" },
  { id: "policies", label: "Policies" },
  { id: "metrics", label: "Metrics" },
]

const RISK_STATUS_BADGE: Record<string, string> = {
  open: "border-red-300/40 bg-red-500/10 text-red-400",
  mitigated: "border-emerald-300/30 bg-emerald-500/10 text-emerald-400",
  accepted: "border-amber-300/40 bg-amber-500/10 text-amber-400",
  closed: "border-zinc-300/20 bg-zinc-500/10 text-zinc-400",
}

const EXCEPTION_STATUS_BADGE: Record<string, string> = {
  active: "border-amber-300/40 bg-amber-500/10 text-amber-400",
  expired: "border-red-300/40 bg-red-500/10 text-red-400",
  revoked: "border-zinc-300/20 bg-zinc-500/10 text-zinc-400",
}

const VENDOR_TIER_BADGE: Record<string, string> = {
  critical: "border-red-300/40 bg-red-500/10 text-red-400",
  high: "border-orange-300/40 bg-orange-500/10 text-orange-400",
  medium: "border-amber-300/40 bg-amber-500/10 text-amber-400",
  low: "border-sky-300/30 bg-sky-500/10 text-sky-400",
}

const POLICY_STATUS_BADGE: Record<string, string> = {
  active: "border-emerald-300/30 bg-emerald-500/10 text-emerald-400",
  draft: "border-amber-300/40 bg-amber-500/10 text-amber-400",
  retired: "border-zinc-300/20 bg-zinc-500/10 text-zinc-400",
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        className ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400",
      )}
    >
      {label}
    </span>
  )
}

function EntityRow({ children, onClick, selected }: { children: React.ReactNode; onClick?: () => void; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full border-b border-border/40 px-6 py-4 text-left transition-colors last:border-0 hover:bg-muted/30",
        selected && "bg-muted/40",
      )}
    >
      {children}
    </button>
  )
}

function FieldPair({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words text-foreground">{value}</span>
    </div>
  )
}

function RiskDetail({ risk }: { risk: ProgramRisk }) {
  const score = risk.residual?.score ?? risk.inherent?.score
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border/70 bg-background px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            label={risk.status}
            className={RISK_STATUS_BADGE[risk.status] ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400"}
          />
          {risk.treatment && <Badge label={risk.treatment} />}
          {score != null && (
            <Badge label={`Score ${score}`} />
          )}
        </div>
        <h2 className="mt-3 text-base font-semibold text-foreground">{risk.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground font-mono">{risk.risk_id}</p>
      </div>
      <div className="space-y-2 px-6 py-5">
        <FieldPair label="Owner" value={risk.owner} />
        <FieldPair label="Created" value={risk.created_at ? new Date(risk.created_at).toLocaleDateString() : null} />
        <FieldPair label="Updated" value={risk.updated_at ? new Date(risk.updated_at).toLocaleDateString() : null} />
        {risk.inherent && (
          <FieldPair
            label="Inherent"
            value={`L${risk.inherent.likelihood ?? "?"} × I${risk.inherent.impact ?? "?"} = ${risk.inherent.score ?? "?"}`}
          />
        )}
        {risk.residual && (
          <FieldPair
            label="Residual"
            value={`L${risk.residual.likelihood ?? "?"} × I${risk.residual.impact ?? "?"} = ${risk.residual.score ?? "?"}`}
          />
        )}
        {risk.linked_findings && risk.linked_findings.length > 0 && (
          <div className="pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Linked findings</p>
            <ul className="space-y-0.5">
              {risk.linked_findings.map((f) => (
                <li key={f} className="font-mono text-xs text-foreground/80">{f}</li>
              ))}
            </ul>
          </div>
        )}
        {risk.tags && risk.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {risk.tags.map((t) => (
              <span key={t} className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ExceptionDetail({ exception: ex }: { exception: ProgramException }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border/70 bg-background px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            label={ex.status}
            className={EXCEPTION_STATUS_BADGE[ex.status] ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400"}
          />
          <Badge label={`${ex.control_framework} / ${ex.control_id}`} />
        </div>
        <h2 className="mt-3 text-base font-semibold text-foreground">{ex.exception_id}</h2>
      </div>
      <div className="space-y-2 px-6 py-5">
        <FieldPair label="Owner" value={ex.owner} />
        <FieldPair label="Created" value={ex.created_at ? new Date(ex.created_at).toLocaleDateString() : null} />
        <FieldPair label="Expires" value={ex.expires_at ? new Date(ex.expires_at).toLocaleDateString() : null} />
        <div className="pt-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Rationale</p>
          <p className="text-sm leading-relaxed text-foreground">{ex.rationale}</p>
        </div>
        {ex.compensating_controls && ex.compensating_controls.length > 0 && (
          <div className="pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Compensating controls</p>
            <ul className="space-y-0.5">
              {ex.compensating_controls.map((c) => (
                <li key={c} className="font-mono text-xs text-foreground/80">{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function VendorDetail({ vendor }: { vendor: ProgramVendor }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border/70 bg-background px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={`Tier ${vendor.tier}`} className={VENDOR_TIER_BADGE[vendor.tier] ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400"} />
          <Badge label={vendor.status} />
        </div>
        <h2 className="mt-3 text-base font-semibold text-foreground">{vendor.name}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{vendor.vendor_id}</p>
      </div>
      <div className="space-y-2 px-6 py-5">
        <FieldPair label="Owner" value={vendor.owner} />
        <FieldPair label="Last review" value={vendor.last_review_at ? new Date(vendor.last_review_at).toLocaleDateString() : null} />
        <FieldPair label="Next review" value={vendor.next_review_at ? new Date(vendor.next_review_at).toLocaleDateString() : null} />
      </div>
    </div>
  )
}

function PolicyDetail({ policy }: { policy: ProgramPolicy }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border/70 bg-background px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={policy.status} className={POLICY_STATUS_BADGE[policy.status] ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400"} />
          <Badge label={`v${policy.version}`} />
        </div>
        <h2 className="mt-3 text-base font-semibold text-foreground">{policy.title}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{policy.policy_id}</p>
      </div>
      <div className="space-y-2 px-6 py-5">
        <FieldPair label="Owner" value={policy.owner} />
        <FieldPair label="Effective" value={policy.effective_at ? new Date(policy.effective_at).toLocaleDateString() : null} />
        <FieldPair label="Next review" value={policy.next_review_at ? new Date(policy.next_review_at).toLocaleDateString() : null} />
        <FieldPair label="Document" value={policy.document_path} />
        {policy.framework_refs && policy.framework_refs.length > 0 && (
          <div className="pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Frameworks</p>
            <div className="flex flex-wrap gap-1.5">
              {policy.framework_refs.map((f) => (
                <span key={f} className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricRow({ metric }: { metric: ProgramMetric }) {
  return (
    <div className="border-b border-border/40 px-6 py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-xs text-muted-foreground">{metric.metric_id}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(metric.recorded_at).toLocaleDateString()}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{metric.value}</span>
        {metric.unit && <span className="text-sm text-muted-foreground">{metric.unit}</span>}
      </div>
      {metric.subject && <p className="mt-0.5 text-xs text-muted-foreground">{metric.subject}</p>}
    </div>
  )
}

export function ProgramSurface({
  program,
  loading,
}: {
  program: ProgramSummary | null
  loading: boolean
}) {
  const [activeTab, setActiveTab] = useState<ProgramTab>(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem("cge.program-active-tab")
      : null;
    return (stored as ProgramTab | null) ?? "risks";
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--editor-bg)] p-8">
        <p className="text-sm text-muted-foreground">Loading program…</p>
      </div>
    )
  }

  const isEmpty =
    !program ||
    (program.risks.length === 0 &&
      program.exceptions.length === 0 &&
      program.vendors.length === 0 &&
      program.policies.length === 0 &&
      program.metrics.length === 0)

  if (isEmpty) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--editor-bg)] p-8">
        <div className="max-w-md text-center">
          <ShieldWarningIcon className="mx-auto mb-3 size-8 text-muted-foreground/30" />
          <h2 className="text-sm font-medium text-foreground">No program records</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create records in <span className="font-mono">grc-data/</span> within your workspace to populate risks, exceptions, vendors, policies, and metrics.
          </p>
        </div>
      </div>
    )
  }

  const counts: Record<ProgramTab, number> = {
    risks: program?.risks.length ?? 0,
    exceptions: program?.exceptions.length ?? 0,
    vendors: program?.vendors.length ?? 0,
    policies: program?.policies.length ?? 0,
    metrics: program?.metrics.length ?? 0,
  }

  function tabContent() {
    if (!program) return null

    if (activeTab === "risks") {
      const selected = selectedId ? program.risks.find((r) => r.risk_id === selectedId) : null
      return (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 overflow-auto border-r border-border/60">
            {program.risks.map((risk) => (
              <EntityRow
                key={risk.risk_id}
                selected={selectedId === risk.risk_id}
                onClick={() => setSelectedId(risk.risk_id)}
              >
                <div className="flex items-start gap-2.5">
                  <WarningCircleIcon className={cn("mt-0.5 size-4 shrink-0", risk.status === "open" ? "text-red-400" : "text-muted-foreground/50")} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{risk.title}</p>
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-foreground/50">{risk.status}{risk.owner ? ` · ${risk.owner}` : ""}</p>
                  </div>
                </div>
              </EntityRow>
            ))}
          </div>
          {selected ? (
            <RiskDetail risk={selected} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Select a risk to view details
            </div>
          )}
        </div>
      )
    }

    if (activeTab === "exceptions") {
      const selected = selectedId ? program.exceptions.find((e) => e.exception_id === selectedId) : null
      return (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 overflow-auto border-r border-border/60">
            {program.exceptions.map((ex) => (
              <EntityRow
                key={ex.exception_id}
                selected={selectedId === ex.exception_id}
                onClick={() => setSelectedId(ex.exception_id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{ex.exception_id}</p>
                  <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-foreground/50">
                    {ex.control_framework}/{ex.control_id} · {ex.status}
                  </p>
                </div>
              </EntityRow>
            ))}
          </div>
          {selected ? (
            <ExceptionDetail exception={selected} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Select an exception to view details
            </div>
          )}
        </div>
      )
    }

    if (activeTab === "vendors") {
      const selected = selectedId ? program.vendors.find((v) => v.vendor_id === selectedId) : null
      return (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 overflow-auto border-r border-border/60">
            {program.vendors.map((vendor) => (
              <EntityRow
                key={vendor.vendor_id}
                selected={selectedId === vendor.vendor_id}
                onClick={() => setSelectedId(vendor.vendor_id)}
              >
                <div className="flex items-start gap-2.5">
                  <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{vendor.name}</p>
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-foreground/50">
                      Tier {vendor.tier} · {vendor.status}
                    </p>
                  </div>
                </div>
              </EntityRow>
            ))}
          </div>
          {selected ? (
            <VendorDetail vendor={selected} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Select a vendor to view details
            </div>
          )}
        </div>
      )
    }

    if (activeTab === "policies") {
      const selected = selectedId ? program.policies.find((p) => p.policy_id === selectedId) : null
      return (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 shrink-0 overflow-auto border-r border-border/60">
            {program.policies.map((policy) => (
              <EntityRow
                key={policy.policy_id}
                selected={selectedId === policy.policy_id}
                onClick={() => setSelectedId(policy.policy_id)}
              >
                <div className="flex items-start gap-2.5">
                  <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{policy.title}</p>
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-foreground/50">
                      {policy.status} · v{policy.version}
                    </p>
                  </div>
                </div>
              </EntityRow>
            ))}
          </div>
          {selected ? (
            <PolicyDetail policy={selected} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Select a policy to view details
            </div>
          )}
        </div>
      )
    }

    if (activeTab === "metrics") {
      return (
        <div className="flex-1 overflow-auto">
          {program.metrics.map((metric, i) => (
            <MetricRow key={`${metric.metric_id}-${i}`} metric={metric} />
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg)]">
      <div className="border-b border-border/70 bg-background">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedId(null); window.localStorage.setItem("cge.program-active-tab", tab.id); }}
              className={cn(
                "flex items-center gap-2 border-b-2 px-5 py-3.5 text-xs font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                activeTab === tab.id ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground",
              )}>
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {tabContent()}
      </div>
    </div>
  )
}
