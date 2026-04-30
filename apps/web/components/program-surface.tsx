"use client"

import { useEffect, type ReactNode } from "react"
import { CopySimpleIcon, FileIcon, ShieldWarningIcon } from "@phosphor-icons/react"

import { TabHeader, TabHeaderButton } from "@/components/tab-header"
import { cn } from "@/lib/utils"
import {
  type ProgramPolicy,
  type ProgramControl,
  type ProgramRisk,
  type ProgramSummary,
  type ProgramVendor,
} from "@/lib/runner"
import { ProgramTabs, type ProgramTab } from "@/components/program-tabs"

const RISK_STATUS_BADGE: Record<string, string> = {
  open: "border-red-300/40 bg-red-500/10 text-red-400",
  mitigated: "border-emerald-300/30 bg-emerald-500/10 text-emerald-400",
  accepted: "border-amber-300/40 bg-amber-500/10 text-amber-400",
  closed: "border-zinc-300/20 bg-zinc-500/10 text-zinc-400",
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

function FieldPair({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words text-foreground">{value}</span>
    </div>
  )
}

function copyText(value: string | null | undefined) {
  if (!value) return
  void navigator.clipboard.writeText(value)
}

function RiskDetail({ risk }: { risk: ProgramRisk }) {
  return (
    <div className="flex-1 overflow-auto">
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

function VendorDetail({ vendor }: { vendor: ProgramVendor }) {
  return (
    <div className="flex-1 overflow-auto">
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

function ControlDetail({ control }: { control: ProgramControl }) {
  const ex = control.exception
  return (
    <div className="flex-1 overflow-auto">
      <div className="space-y-2 px-6 py-5">
        <FieldPair label="Owner" value={control.owner} />
        <FieldPair label="Last tested" value={control.last_tested_at ? new Date(control.last_tested_at).toLocaleDateString() : null} />
        <FieldPair label="Next test" value={control.next_test_at ? new Date(control.next_test_at).toLocaleDateString() : null} />
        {control.framework_refs && control.framework_refs.length > 0 && (
          <div className="pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Frameworks</p>
            <div className="flex flex-wrap gap-1.5">
              {control.framework_refs.map((f) => (
                <span key={f} className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>
        )}
        {control.policy_refs && control.policy_refs.length > 0 && (
          <div className="pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Policies</p>
            <ul className="space-y-0.5">
              {control.policy_refs.map((p) => (
                <li key={p} className="font-mono text-xs text-foreground/80">{p}</li>
              ))}
            </ul>
          </div>
        )}
        {ex && (
          <div className="mt-4 rounded border border-amber-300/30 bg-amber-500/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Exception</span>
              <Badge label={ex.status} className="border-amber-300/40 bg-amber-500/10 text-amber-400" />
              {ex.expires_at && (
                <span className="text-[11px] text-muted-foreground">Expires {new Date(ex.expires_at).toLocaleDateString()}</span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground">{ex.rationale}</p>
            {ex.compensating_controls && ex.compensating_controls.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {ex.compensating_controls.map((c) => (
                  <li key={c} className="font-mono text-xs text-foreground/70">{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ProgramSurface({
  activeTab,
  program,
  loading,
  onSelectTab,
  selectedItemId,
}: {
  activeTab: ProgramTab
  program: ProgramSummary | null
  loading: boolean
  onSelectTab: (tab: ProgramTab) => void
  selectedItemId: string | null
}) {
  useEffect(() => {
    window.localStorage.setItem("cge.program-active-tab", activeTab)
  }, [activeTab])

  const isEmpty =
    !loading &&
    (!program ||
      ((program.risks?.length ?? 0) === 0 &&
        (program.vendors?.length ?? 0) === 0 &&
        (program.policies?.length ?? 0) === 0 &&
        (program.controls?.length ?? 0) === 0))

  function resolveRecordHeader(): ReactNode {
    if (loading || isEmpty || !program) {
      const singular = activeTab.replace(/s$/, "")
      return (
        <TabHeader
          title={`No ${singular} selected`}
          actions={<TabHeaderButton icon={CopySimpleIcon} disabled>Copy ID</TabHeaderButton>}
        />
      )
    }

    if (activeTab === "risks") {
      const risk = selectedItemId ? (program.risks ?? []).find((r) => r.risk_id === selectedItemId) : null
      if (!risk) return <TabHeader title="No risk selected" actions={<TabHeaderButton icon={CopySimpleIcon} disabled>Copy ID</TabHeaderButton>} />
      const score = risk.residual?.score ?? risk.inherent?.score
      return (
        <TabHeader
         
          title={risk.title}
          identifier={risk.risk_id}
          badges={<>
            <Badge label={risk.status} className={RISK_STATUS_BADGE[risk.status] ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400"} />
            {risk.treatment ? <Badge label={risk.treatment} /> : null}
            {score != null ? <Badge label={`Score ${score}`} /> : null}
          </>}
          meta={[
            ...(risk.owner ? [{ label: "Owner", value: risk.owner }] : []),
            ...(risk.created_at ? [{ label: "Created", value: new Date(risk.created_at).toLocaleDateString() }] : []),
            ...(risk.updated_at ? [{ label: "Updated", value: new Date(risk.updated_at).toLocaleDateString() }] : []),
          ]}
          actions={<TabHeaderButton icon={CopySimpleIcon} onClick={() => copyText(risk.risk_id)}>Copy ID</TabHeaderButton>}
        />
      )
    }

    if (activeTab === "vendors") {
      const vendor = selectedItemId ? (program.vendors ?? []).find((v) => v.vendor_id === selectedItemId) : null
      if (!vendor) return <TabHeader title="No vendor selected" actions={<TabHeaderButton icon={CopySimpleIcon} disabled>Copy ID</TabHeaderButton>} />
      return (
        <TabHeader
         
          title={vendor.name}
          identifier={vendor.vendor_id}
          badges={<>
            <Badge label={`Tier ${vendor.tier}`} className={VENDOR_TIER_BADGE[vendor.tier] ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400"} />
            <Badge label={vendor.status} />
          </>}
          meta={[
            ...(vendor.owner ? [{ label: "Owner", value: vendor.owner }] : []),
            ...(vendor.last_review_at ? [{ label: "Last review", value: new Date(vendor.last_review_at).toLocaleDateString() }] : []),
            ...(vendor.next_review_at ? [{ label: "Next review", value: new Date(vendor.next_review_at).toLocaleDateString() }] : []),
          ]}
          actions={<TabHeaderButton icon={CopySimpleIcon} onClick={() => copyText(vendor.vendor_id)}>Copy ID</TabHeaderButton>}
        />
      )
    }

    if (activeTab === "policies") {
      const policy = selectedItemId ? (program.policies ?? []).find((p) => p.policy_id === selectedItemId) : null
      if (!policy) return <TabHeader title="No policy selected" actions={<TabHeaderButton icon={CopySimpleIcon} disabled>Copy ID</TabHeaderButton>} />
      return (
        <TabHeader
         
          title={policy.title}
          identifier={policy.policy_id}
          badges={<>
            <Badge label={policy.status} className={POLICY_STATUS_BADGE[policy.status] ?? "border-zinc-300/20 bg-zinc-500/10 text-zinc-400"} />
            <Badge label={`v${policy.version}`} />
          </>}
          meta={[
            ...(policy.owner ? [{ label: "Owner", value: policy.owner }] : []),
            ...(policy.effective_at ? [{ label: "Effective", value: new Date(policy.effective_at).toLocaleDateString() }] : []),
            ...(policy.next_review_at ? [{ label: "Next review", value: new Date(policy.next_review_at).toLocaleDateString() }] : []),
          ]}
          actions={<>
            <TabHeaderButton icon={CopySimpleIcon} onClick={() => copyText(policy.policy_id)}>Copy ID</TabHeaderButton>
            <TabHeaderButton icon={FileIcon} onClick={() => copyText(policy.document_path)}>Copy Path</TabHeaderButton>
          </>}
        />
      )
    }

    if (activeTab === "controls") {
      const control = selectedItemId ? (program.controls ?? []).find((c) => c.control_id === selectedItemId) : null
      if (!control) return <TabHeader title="No control selected" actions={<TabHeaderButton icon={CopySimpleIcon} disabled>Copy ID</TabHeaderButton>} />
      return (
        <TabHeader
         
          title={control.title}
          identifier={control.control_id}
          badges={<>
            <Badge label={control.status} />
            {control.automation_status ? <Badge label={control.automation_status} /> : null}
          </>}
          meta={[
            ...(control.owner ? [{ label: "Owner", value: control.owner }] : []),
            ...(control.last_tested_at ? [{ label: "Last tested", value: new Date(control.last_tested_at).toLocaleDateString() }] : []),
            ...(control.next_test_at ? [{ label: "Next test", value: new Date(control.next_test_at).toLocaleDateString() }] : []),
          ]}
          actions={<TabHeaderButton icon={CopySimpleIcon} onClick={() => copyText(control.control_id)}>Copy ID</TabHeaderButton>}
        />
      )
    }

    return null
  }

  function tabContent() {
    if (loading) {
      return <div className="flex flex-1 items-center justify-center p-8"><p className="text-sm text-muted-foreground">Loading program…</p></div>
    }

    if (isEmpty || !program) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <ShieldWarningIcon className="mx-auto mb-3 size-8 text-muted-foreground/30" />
            <h2 className="text-sm font-medium text-foreground">No program records</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create records in <span className="font-mono">grc-data/</span> within your workspace to populate risks, vendors, policies, and controls.
            </p>
          </div>
        </div>
      )
    }

    if (activeTab === "risks") {
      const risks = program.risks ?? []
      const selected = selectedItemId ? risks.find((r) => r.risk_id === selectedItemId) : null
      return selected ? <RiskDetail risk={selected} /> : <EmptyDetail label="risk" />
    }
    if (activeTab === "vendors") {
      const vendors = program.vendors ?? []
      const selected = selectedItemId ? vendors.find((v) => v.vendor_id === selectedItemId) : null
      return selected ? <VendorDetail vendor={selected} /> : <EmptyDetail label="vendor" />
    }
    if (activeTab === "policies") {
      const policies = program.policies ?? []
      const selected = selectedItemId ? policies.find((p) => p.policy_id === selectedItemId) : null
      return selected ? <PolicyDetail policy={selected} /> : <EmptyDetail label="policy" />
    }
    if (activeTab === "controls") {
      const controls = program.controls ?? []
      const selected = selectedItemId ? controls.find((c) => c.control_id === selectedItemId) : null
      return selected ? <ControlDetail control={selected} /> : <EmptyDetail label="control" />
    }

    return null
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg)]">
      {resolveRecordHeader()}
      <div className="flex flex-1 overflow-hidden">
        {tabContent()}
      </div>
      <ProgramTabs activeTab={activeTab} onSelectTab={(tab) => tab && onSelectTab(tab)} />
    </div>
  )
}

function EmptyDetail({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      Select a {label} from the sidebar to view details
    </div>
  )
}
