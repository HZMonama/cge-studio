"use client"

import * as React from "react"
import {
  CloudIcon,
  ChartBarIcon,
  CheckIcon,
  FileTextIcon,
  FunnelIcon,
  HandshakeIcon,
  MagnifyingGlassIcon,
  ShieldStarIcon,
  UsersIcon,
  WrenchIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { getPluginCategory, type Persona, type Plugin, type PluginCategory } from "@/lib/plugins"
import { type ProgramSummary, type RunnerArtifactSummary, type RunnerFindingSummary } from "@/lib/runner"
import { type ProgramTab } from "@/components/program-tabs"
import { usePluginPanel } from "@/stores/plugin-panel-store"
import { useAppStore } from "@/stores/app-store"

import { Kbd } from "@/components/ui/kbd"
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SidebarSection = "runner" | "findings" | "program" | "metrics" | "artifacts"

const PERSONAS: { id: Persona; label: string }[] = [
  { id: "engineer", label: "Engineer" },
  { id: "auditor",  label: "Auditor" },
  { id: "internal", label: "Internal" },
  { id: "tprm",     label: "TPRM" },
]

const CATEGORIES: { id: PluginCategory; label: string }[] = [
  { id: "persona",   label: "Personas" },
  { id: "framework", label: "Frameworks" },
  { id: "connector", label: "Connectors" },
  { id: "reporting", label: "Reporting" },
  { id: "transform", label: "Transforms" },
  { id: "program",   label: "Programs" },
  { id: "meeting",   label: "Meetings" },
  { id: "tool",      label: "Tools" },
]

const ARTIFACT_KINDS: { id: string; label: string }[] = [
  { id: "report",   label: "Reports" },
  { id: "code",     label: "Code" },
  { id: "document", label: "Documents" },
  { id: "findings", label: "Findings" },
]

function getBrandIcon(pluginId: string, theme: "dark" | "light"): string | null {
  const icons: Record<string, { dark: string; light: string }> = {
    "github-inspector": { dark: "/github_dark.svg", light: "/github_light.svg" },
    "okta-inspector":   { dark: "/okta_dark.png", light: "/okta_light.svg" },
    "aws-inspector":    { dark: "/aws_dark.svg", light: "/aws_light.svg" },
    "gcp-inspector":    { dark: "/google_cloud.svg", light: "/google_cloud.svg" },
  }
  return icons[pluginId]?.[theme] ?? null
}

const FRAMEWORK_FLAG_CODES: Partial<Record<string, string>> = {
  "cis-controls": "us",
  "cmmc": "us",
  "csa-ccm": "un",
  "dora": "eu",
  "essential8": "au",
  "fedramp-20x": "us",
  "fedramp-rev5": "us",
  "gdpr": "eu",
  "glba": "us",
  "hitrust": "us",
  "irap": "au",
  "ind-dpdpa": "in",
  "ismap": "jp",
  "iso27001": "un",
  "nist-800-53": "us",
  "nydfs": "us",
  "pbmm": "ca",
  "pci-dss": "un",
  "singapore-pdpa": "sg",
  "soc2": "us",
  "stateramp": "us",
  "us-export": "us",
}

const EMPTY_STATE_COPY: Record<Exclude<SidebarSection, "runner">, { title: string; description: string }> = {
  findings: {
    title: "No findings yet",
    description: "Structured findings and remediation-linked issue navigation will appear here.",
  },
  program: {
    title: "No program records yet",
    description: "Program navigation will live here for risks, policies, vendors, and related entities.",
  },
  artifacts: {
    title: "No artifacts yet",
    description: "Generated reports, exports, and saved outputs will be listed here.",
  },
  metrics: {
    title: "No metrics yet",
    description: "Durable measurements emitted by setup, status, collection, and program commands will appear here.",
  },
}

const SEARCH_PLACEHOLDERS: Record<SidebarSection, string> = {
  runner: "Search plugins...",
  findings: "Search findings...",
  program: "Search program records...",
  metrics: "Search metrics...",
  artifacts: "Search artifacts...",
}

function SidebarPhosphorIcon({
  Icon,
  className,
  filled,
}: {
  Icon: React.ElementType
  className?: string
  filled?: boolean
}) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center", className)}>
      <Icon className={cn("size-full transition-opacity", filled && "opacity-0")} />
      <Icon weight="fill" className={cn("absolute inset-0 size-full transition-opacity", filled ? "opacity-100" : "opacity-0")} />
    </span>
  )
}

function SidebarFlagIcon({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "fib h-3 w-4 shrink-0 overflow-hidden rounded-[2px] border border-sidebar-foreground/10 bg-center bg-no-repeat shadow-sm",
        `fi-${code}`,
        className
      )}
    />
  )
}

function pluginIcon(plugin: Plugin): React.ElementType {
  if (plugin.id === "grc-engineer")     return WrenchIcon
  if (plugin.id === "grc-auditor")      return MagnifyingGlassIcon
  if (plugin.id === "grc-internal")     return UsersIcon
  if (plugin.id === "grc-tprm")         return HandshakeIcon
  if (plugin.id === "fedramp-ssp" || plugin.id === "oscal") return FileTextIcon
  if (plugin.type === "connector")      return CloudIcon
  if (plugin.type === "framework")      return ShieldStarIcon
  return FileTextIcon
}

function PluginItem({ plugin }: { plugin: Plugin }) {
  const { theme } = useAppStore()
  const brandSrc = getBrandIcon(plugin.id, theme)
  const flagCode = plugin.type === "framework" ? FRAMEWORK_FLAG_CODES[plugin.id] : null
  const Icon = pluginIcon(plugin)
  const { selectedPlugin, setSelectedPlugin } = usePluginPanel()
  const isSelected = selectedPlugin?.id === plugin.id

  return (
    <SidebarMenuItem>
      <button
        onClick={() => setSelectedPlugin(isSelected ? null : plugin)}
        className={cn(
          "sidebar-fade-item group/plugin-item flex h-(--row-h) w-full items-center gap-2 overflow-hidden px-4 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground focus-visible:ring-2",
          isSelected
            ? "sidebar-fade-item-active text-sidebar-accent-foreground"
            : "text-foreground/60",
        )}
      >
        {brandSrc
          ? <img src={brandSrc} alt="" className="size-4 shrink-0 object-contain" />
          : flagCode
            ? <SidebarFlagIcon code={flagCode} />
          : (
            <SidebarPhosphorIcon
              Icon={Icon}
              filled={isSelected}
              className="size-4 group-hover/plugin-item:[&>svg:first-child]:opacity-0 group-hover/plugin-item:[&>svg:last-child]:opacity-100"
            />
          )
        }
        <span className="truncate font-mono text-base font-light">{plugin.label}</span>
      </button>
    </SidebarMenuItem>
  )
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-amber-400",
  low: "bg-sky-400",
  info: "bg-zinc-400",
}

const SEVERITY_LABEL_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-sky-400",
  info: "text-zinc-400",
}

function FindingItem({
  finding,
  isSelected,
  onSelect,
}: {
  finding: RunnerFindingSummary
  isSelected: boolean
  onSelect: (findingId: string) => void
}) {
  const subline = [
    finding.source,
    finding.controlFramework && finding.controlId
      ? `${finding.controlFramework}/${finding.controlId}`
      : (finding.controlId ?? null),
    finding.resourceType,
  ]
    .filter(Boolean)
    .join(" · ")

  const tertiary = [finding.resourceRegion, finding.accountId]
    .filter(Boolean)
    .join(" / ")

  return (
    <SidebarMenuItem>
      <button
        onClick={() => onSelect(finding.id)}
        className={cn(
          "sidebar-fade-item group/finding-item flex h-auto w-full items-start gap-2.5 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground focus-visible:ring-2",
          isSelected
            ? "sidebar-fade-item-active text-sidebar-accent-foreground"
            : "text-foreground/60",
        )}
      >
        <span
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            SEVERITY_DOT[finding.severity] ?? "bg-zinc-400",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate font-medium leading-snug">{finding.title}</p>
            <span className={cn("shrink-0 text-[10px] font-semibold uppercase", SEVERITY_LABEL_COLOR[finding.severity])}>
              {finding.severity}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-foreground/45">
            {subline}
          </p>
          {tertiary && (
            <p className="mt-0.5 truncate text-[10px] text-foreground/35">{tertiary}</p>
          )}
        </div>
      </button>
    </SidebarMenuItem>
  )
}

function ArtifactItem({
  artifact,
  isSelected,
  onSelect,
}: {
  artifact: RunnerArtifactSummary
  isSelected: boolean
  onSelect: (artifactId: string) => void
}) {
  return (
    <SidebarMenuItem>
      <button
        onClick={() => onSelect(artifact.id)}
        className={cn(
          "sidebar-fade-item group/artifact-item flex h-auto w-full items-start gap-2 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground focus-visible:ring-2",
          isSelected
            ? "sidebar-fade-item-active text-sidebar-accent-foreground"
            : "text-foreground/60",
        )}
      >
        <SidebarPhosphorIcon
          Icon={FileTextIcon}
          filled={isSelected}
          className="mt-0.5 size-4 group-hover/artifact-item:[&>svg:first-child]:opacity-0 group-hover/artifact-item:[&>svg:last-child]:opacity-100"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{artifact.title}</p>
          <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-foreground/45">
            {artifact.kind}
          </p>
        </div>
      </button>
    </SidebarMenuItem>
  )
}

function ProgramSidebarContent({
  activeTab,
  query,
  program,
  selectedItemId,
  onSelectItem,
}: {
  activeTab: ProgramTab | null
  query?: string
  program?: ProgramSummary | null
  selectedItemId?: string | null
  onSelectItem?: (itemId: string) => void
}) {
  if (!program) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-xs text-foreground/40">Loading program data...</p>
      </div>
    )
  }

  const q = query?.trim().toLowerCase() ?? ""

  const risks = (program.risks ?? []).filter((r) =>
    !q || r.title.toLowerCase().includes(q) || r.status.toLowerCase().includes(q) || (r.owner ?? "").toLowerCase().includes(q) || r.risk_id.toLowerCase().includes(q)
  )
  const vendors = (program.vendors ?? []).filter((v) =>
    !q || v.name.toLowerCase().includes(q) || v.vendor_id.toLowerCase().includes(q) || v.status.toLowerCase().includes(q)
  )
  const policies = (program.policies ?? []).filter((p) =>
    !q || p.title.toLowerCase().includes(q) || p.policy_id.toLowerCase().includes(q) || p.status.toLowerCase().includes(q)
  )
  const controls = (program.controls ?? []).filter((c) =>
    !q || c.title.toLowerCase().includes(q) || c.control_id.toLowerCase().includes(q) || c.status.toLowerCase().includes(q) || (c.owner ?? "").toLowerCase().includes(q)
  )

  function renderRisks(items: typeof risks) {
    return items.map((risk) => (
      <SidebarMenuItem key={risk.risk_id}>
        <button
          onClick={() => onSelectItem?.(risk.risk_id)}
          className={cn(
            "sidebar-fade-item flex h-auto w-full items-start gap-2 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground",
            selectedItemId === risk.risk_id
              ? "sidebar-fade-item-active text-sidebar-accent-foreground"
              : "text-foreground/60"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{risk.title}</p>
            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-foreground/45">
              {risk.status}{risk.owner ? ` · ${risk.owner}` : ""}
            </p>
          </div>
        </button>
      </SidebarMenuItem>
    ))
  }

  function renderVendors(items: typeof vendors) {
    return items.map((vendor) => (
      <SidebarMenuItem key={vendor.vendor_id}>
        <button
          onClick={() => onSelectItem?.(vendor.vendor_id)}
          className={cn(
            "sidebar-fade-item flex h-auto w-full items-start gap-2 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground",
            selectedItemId === vendor.vendor_id
              ? "sidebar-fade-item-active text-sidebar-accent-foreground"
              : "text-foreground/60"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{vendor.name}</p>
            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-foreground/45">
              Tier {vendor.tier} · {vendor.status}
            </p>
          </div>
        </button>
      </SidebarMenuItem>
    ))
  }

  function renderPolicies(items: typeof policies) {
    return items.map((policy) => (
      <SidebarMenuItem key={policy.policy_id}>
        <button
          onClick={() => onSelectItem?.(policy.policy_id)}
          className={cn(
            "sidebar-fade-item flex h-auto w-full items-start gap-2 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground",
            selectedItemId === policy.policy_id
              ? "sidebar-fade-item-active text-sidebar-accent-foreground"
              : "text-foreground/60"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{policy.title}</p>
            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-foreground/45">
              {policy.status} · v{policy.version}
            </p>
          </div>
        </button>
      </SidebarMenuItem>
    ))
  }

  function renderControls(items: typeof controls) {
    return items.map((control) => (
      <SidebarMenuItem key={control.control_id}>
        <button
          onClick={() => onSelectItem?.(control.control_id)}
          className={cn(
            "sidebar-fade-item flex h-auto w-full items-start gap-2 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground",
            selectedItemId === control.control_id
              ? "sidebar-fade-item-active text-sidebar-accent-foreground"
              : "text-foreground/60"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{control.title}</p>
            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-foreground/45">
              {control.status}{control.owner ? ` · ${control.owner}` : ""}
            </p>
          </div>
        </button>
      </SidebarMenuItem>
    ))
  }

  if (activeTab === null) {
    const total = risks.length + vendors.length + policies.length + controls.length
    if (total === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-xs text-foreground/40">{q ? "No records match" : "No program records"}</p>
        </div>
      )
    }
    return (
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <SidebarMenu>
            {renderRisks(risks)}
            {renderVendors(vendors)}
            {renderPolicies(policies)}
            {renderControls(controls)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  if (activeTab === "risks") {
    if (risks.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-xs text-foreground/40">{q ? "No risks match" : "No risks recorded"}</p>
        </div>
      )
    }
    return (
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <SidebarMenu>{renderRisks(risks)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  if (activeTab === "vendors") {
    if (vendors.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-xs text-foreground/40">{q ? "No vendors match" : "No vendors recorded"}</p>
        </div>
      )
    }
    return (
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <SidebarMenu>{renderVendors(vendors)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  if (activeTab === "policies") {
    if (policies.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-xs text-foreground/40">{q ? "No policies match" : "No policies recorded"}</p>
        </div>
      )
    }
    return (
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <SidebarMenu>{renderPolicies(policies)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  if (activeTab === "controls") {
    if (controls.length === 0) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-xs text-foreground/40">{q ? "No controls match" : "No controls recorded"}</p>
        </div>
      )
    }
    return (
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <SidebarMenu>{renderControls(controls)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return null
}

function MetricsSidebarContent({
  query,
  program,
  selectedItemId,
  onSelectItem,
}: {
  query?: string
  program?: ProgramSummary | null
  selectedItemId?: string | null
  onSelectItem?: (itemId: string) => void
}) {
  if (!program) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-xs text-foreground/40">Loading metrics...</p>
      </div>
    )
  }

  const q = query?.trim().toLowerCase() ?? ""
  const metrics = (program.metrics ?? []).filter((metric) =>
    !q ||
    metric.metric_id.toLowerCase().includes(q) ||
    String(metric.value).toLowerCase().includes(q) ||
    (metric.subject ?? "").toLowerCase().includes(q) ||
    (metric.source ?? "").toLowerCase().includes(q)
  )

  if (metrics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-xs text-foreground/40">{q ? "No metrics match" : "No metrics recorded"}</p>
      </div>
    )
  }

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu>
          {metrics.map((metric, index) => {
            const id = `${metric.metric_id}-${metric.recorded_at}-${index}`
            return (
              <SidebarMenuItem key={id}>
                <button
                  onClick={() => onSelectItem?.(id)}
                  className={cn(
                    "sidebar-fade-item flex h-auto w-full items-start gap-2 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:text-sidebar-accent-foreground",
                    selectedItemId === id
                      ? "sidebar-fade-item-active text-sidebar-accent-foreground"
                      : "text-foreground/60"
                  )}
                >
                  <ChartBarIcon className="mt-0.5 size-4 shrink-0 text-foreground/40" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{metric.metric_id}</p>
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-foreground/45">
                      {metric.value} {metric.unit ?? ""}
                    </p>
                  </div>
                </button>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({
  activeSection = "runner",
  activeProgramTab = null,
  artifacts = [],
  className,
  findings = [],
  focusSearchToken,
  onSelectArtifact,
  onSelectFinding,
  onSelectProgramItem,
  plugins,
  program,
  selectedArtifactId,
  selectedFindingId,
  selectedProgramItemId,
  ...props
}: React.ComponentProps<"aside"> & {
  activeSection?: SidebarSection
  activeProgramTab?: ProgramTab | null
  artifacts?: RunnerArtifactSummary[]
  findings?: RunnerFindingSummary[]
  focusSearchToken?: number
  onSelectArtifact?: (artifactId: string) => void
  onSelectFinding?: (findingId: string) => void
  onSelectProgramItem?: (itemId: string) => void
  plugins: Plugin[]
  program?: ProgramSummary | null
  selectedArtifactId?: string | null
  selectedFindingId?: string | null
  selectedProgramItemId?: string | null
}) {
  const [query, setQuery] = React.useState("")
  const [activePersona, setActivePersona] = React.useState<Persona | null>(null)
  const [activeCategories, setActiveCategories] = React.useState<PluginCategory[]>([])
  const [activeArtifactKinds, setActiveArtifactKinds] = React.useState<string[]>([])
  const searchRef = React.useRef<HTMLInputElement>(null)

  const activePersonaLabel = PERSONAS.find(persona => persona.id === activePersona)?.label
  const filterLabel = activeCategories.length > 0
    ? activeCategories.length === 1
      ? CATEGORIES.find(category => category.id === activeCategories[0])?.label ?? "Filter"
      : `${activeCategories.length} categories`
    : activePersonaLabel ?? "All"

  function toggleCategory(category: PluginCategory) {
    setActiveCategories((prev) => (
      prev.includes(category)
        ? prev.filter(id => id !== category)
        : [...prev, category]
    ))
  }

  function toggleArtifactKind(kind: string) {
    setActiveArtifactKinds((prev) => (
      prev.includes(kind)
        ? prev.filter(id => id !== kind)
        : [...prev, kind]
    ))
  }

  React.useEffect(() => {
    if (focusSearchToken == null) {
      return
    }

    searchRef.current?.focus()
    searchRef.current?.select()
  }, [focusSearchToken])

  const visible = plugins.filter((p) => {
    if (p.id === "pipeline") return false
    const matchesPersona = !activePersona || p.personas.includes(activePersona)
    const matchesCategory = activeCategories.length === 0 || activeCategories.includes(getPluginCategory(p))
    const matchesQuery = !query || p.id.includes(query.toLowerCase()) || p.label.toLowerCase().includes(query.toLowerCase())
    return matchesPersona && matchesCategory && matchesQuery
  })
  const visibleArtifacts = artifacts.filter((artifact) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery = !normalizedQuery
      || artifact.title.toLowerCase().includes(normalizedQuery)
      || artifact.commandPath.toLowerCase().includes(normalizedQuery)
      || artifact.id.toLowerCase().includes(normalizedQuery)
    const matchesKind = activeArtifactKinds.length === 0 || activeArtifactKinds.includes(artifact.kind)
    return matchesQuery && matchesKind
  })

  const visibleFindings = findings.filter((finding) => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return true
    return (
      finding.title.toLowerCase().includes(normalizedQuery) ||
      (finding.message ?? "").toLowerCase().includes(normalizedQuery) ||
      (finding.resourceId ?? "").toLowerCase().includes(normalizedQuery) ||
      (finding.controlId ?? "").toLowerCase().includes(normalizedQuery) ||
      (finding.controlFramework ?? "").toLowerCase().includes(normalizedQuery) ||
      finding.source.toLowerCase().includes(normalizedQuery)
    )
  })

  return (
    <aside
      className={cn(
        "flex h-full w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] shrink-0 flex-col border-r border-border/70 bg-background text-foreground",
        className
      )}
      {...props}
    >
      {/* Search bar */}
      <div className="group/search-row relative shrink-0 flex h-(--row-h) min-h-(--row-h) max-h-(--row-h) items-center overflow-hidden border-b border-border/70 bg-background/68 px-2 backdrop-blur-md">
            <SidebarPhosphorIcon
              Icon={MagnifyingGlassIcon}
              className="size-3.5 text-foreground/50 group-hover/search-row:[&>svg:first-child]:opacity-0 group-hover/search-row:[&>svg:last-child]:opacity-100 group-focus-within/search-row:[&>svg:first-child]:opacity-0 group-focus-within/search-row:[&>svg:last-child]:opacity-100"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                activeSection === "program" && activeProgramTab
                  ? `Search program ${activeProgramTab}...`
                  : SEARCH_PLACEHOLDERS[activeSection]
              }
              className="min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none"
            />
            {!query.trim() && (
              <>
                <Kbd className="mr-1 hidden h-5 shrink-0 px-1.5 text-[10px] text-muted-foreground md:inline-flex">
                  Alt + S
                </Kbd>
                <Kbd className="h-5 shrink-0 px-1.5 text-[10px] text-muted-foreground">
                  {activeSection === "runner" && visible.length}
                  {activeSection === "findings" && visibleFindings.length}
                  {activeSection === "metrics" && (program?.metrics?.length ?? 0)}
                  {activeSection === "artifacts" && visibleArtifacts.length}
                  {activeSection === "program" && program && (
                    activeProgramTab === null
                      ? (program.risks?.length ?? 0) + (program.vendors?.length ?? 0) + (program.policies?.length ?? 0) + (program.controls?.length ?? 0)
                      : (program[activeProgramTab]?.length ?? 0)
                  )}
                </Kbd>
              </>
            )}
          </div>

      <SidebarContent>
        {activeSection === "runner" ? (
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {visible.map((plugin) => (
                  <PluginItem key={plugin.id} plugin={plugin} />
                ))}
                {visible.length === 0 && (
                  <li className="px-4 py-4 text-center text-xs text-foreground/40">
                    No plugins match
                  </li>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : activeSection === "findings" ? (
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleFindings.map((finding) => (
                  <FindingItem
                    key={finding.id}
                    finding={finding}
                    isSelected={selectedFindingId === finding.id}
                    onSelect={(findingId) => onSelectFinding?.(findingId)}
                  />
                ))}
                {visibleFindings.length === 0 && (
                  <li className="px-4 py-4 text-center text-xs text-foreground/40">
                    {findings.length === 0 ? EMPTY_STATE_COPY.findings.description : "No findings match"}
                  </li>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : activeSection === "artifacts" ? (
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleArtifacts.map((artifact) => (
                  <ArtifactItem
                    key={artifact.id}
                    artifact={artifact}
                    isSelected={selectedArtifactId === artifact.id}
                    onSelect={(artifactId) => onSelectArtifact?.(artifactId)}
                  />
                ))}
                {visibleArtifacts.length === 0 && (
                  <li className="px-4 py-4 text-center text-xs text-foreground/40">
                    No artifacts match
                  </li>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : activeSection === "program" ? (
          <ProgramSidebarContent
            activeTab={activeProgramTab}
            query={query}
            program={program}
            selectedItemId={selectedProgramItemId}
            onSelectItem={onSelectProgramItem}
          />
        ) : activeSection === "metrics" ? (
          <MetricsSidebarContent
            query={query}
            program={program}
            selectedItemId={selectedProgramItemId}
            onSelectItem={onSelectProgramItem}
          />
        ) : activeSection === "findings" ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="max-w-44">
              <p className="text-sm font-medium text-foreground">
                {EMPTY_STATE_COPY.findings.title}
              </p>
              <p className="mt-2 text-xs leading-5 text-foreground/55">
                {EMPTY_STATE_COPY.findings.description}
              </p>
            </div>
          </div>
        ) : activeSection === "artifacts" ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="max-w-44">
              <p className="text-sm font-medium text-foreground">
                {EMPTY_STATE_COPY.artifacts.title}
              </p>
              <p className="mt-2 text-xs leading-5 text-foreground/55">
                {EMPTY_STATE_COPY.artifacts.description}
              </p>
            </div>
          </div>
        ) : null}
      </SidebarContent>
    </aside>
  )
}
