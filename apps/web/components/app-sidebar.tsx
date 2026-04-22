"use client"

import * as React from "react"
import {
  CloudIcon,
  CheckIcon,
  FileTextIcon,
  FunnelIcon,
  GearSixIcon,
  HandshakeIcon,
  MagnifyingGlassIcon,
  ShieldStarIcon,
  UsersIcon,
  WrenchIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { getPluginCategory, type Persona, type Plugin, type PluginCategory } from "@/lib/plugins"
import { type RunnerArtifactSummary } from "@/lib/runner"
import { usePluginPanel } from "@/stores/plugin-panel-store"

import Grainient from "@/components/Grainient"
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
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SidebarSection = "chat" | "dashboards" | "findings" | "program" | "artifacts"

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
  { id: "dashboard", label: "Dashboards" },
  { id: "transform", label: "Transforms" },
  { id: "program",   label: "Programs" },
  { id: "meeting",   label: "Meetings" },
  { id: "tool",      label: "Tools" },
]

const BRAND_ICONS: Partial<Record<string, string>> = {
  "github-inspector": "/github_dark.svg",
  "okta-inspector":   "/okta_dark.png",
  "aws-inspector":    "/aws_dark.svg",
  "gcp-inspector":    "/google_cloud.svg",
}

const EMPTY_STATE_COPY: Record<Exclude<SidebarSection, "chat">, { title: string; description: string }> = {
  dashboards: {
    title: "No dashboards yet",
    description: "Dashboard navigation will appear here once dashboard entities are available.",
  },
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
}

const SEARCH_PLACEHOLDERS: Record<SidebarSection, string> = {
  chat: "Search plugins...",
  dashboards: "Search dashboards...",
  findings: "Search findings...",
  program: "Search program records...",
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
  const brandSrc = BRAND_ICONS[plugin.id]
  const Icon = pluginIcon(plugin)
  const { selectedPlugin, setSelectedPlugin } = usePluginPanel()
  const isSelected = selectedPlugin?.id === plugin.id

  return (
    <SidebarMenuItem>
      <button
        onClick={() => setSelectedPlugin(isSelected ? null : plugin)}
        className={cn(
          "group/plugin-item flex h-(--row-h) w-full items-center gap-2 overflow-hidden px-4 text-left text-xs outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
          isSelected && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        {brandSrc
          ? <img src={brandSrc} alt="" className="size-4 shrink-0 object-contain" />
          : (
            <SidebarPhosphorIcon
              Icon={Icon}
              filled={isSelected}
              className="size-4 group-hover/plugin-item:[&>svg:first-child]:opacity-0 group-hover/plugin-item:[&>svg:last-child]:opacity-100"
            />
          )
        }
        <span className="truncate">{plugin.label}</span>
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
          "group/artifact-item flex h-auto w-full items-start gap-2 overflow-hidden px-4 py-3 text-left text-xs outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
          isSelected && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <SidebarPhosphorIcon
          Icon={FileTextIcon}
          filled={isSelected}
          className="mt-0.5 size-4 group-hover/artifact-item:[&>svg:first-child]:opacity-0 group-hover/artifact-item:[&>svg:last-child]:opacity-100"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{artifact.title}</p>
          <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/45">
            {artifact.commandPath}
          </p>
        </div>
      </button>
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  activeSection = "chat",
  artifacts = [],
  className,
  focusSearchToken,
  onSelectArtifact,
  plugins,
  selectedArtifactId,
  ...props
}: React.ComponentProps<"aside"> & {
  activeSection?: SidebarSection
  artifacts?: RunnerArtifactSummary[]
  focusSearchToken?: number
  onSelectArtifact?: (artifactId: string) => void
  plugins: Plugin[]
  selectedArtifactId?: string | null
}) {
  const [query, setQuery] = React.useState("")
  const [activePersona, setActivePersona] = React.useState<Persona | null>(null)
  const [activeCategories, setActiveCategories] = React.useState<PluginCategory[]>([])
  const searchRef = React.useRef<HTMLInputElement>(null)
  const { openConfig, configOpen } = usePluginPanel()

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

  React.useEffect(() => {
    if (focusSearchToken == null) {
      return
    }

    searchRef.current?.focus()
    searchRef.current?.select()
  }, [focusSearchToken])

  const visible = plugins.filter((p) => {
    const matchesPersona = !activePersona || p.personas.includes(activePersona)
    const matchesCategory = activeCategories.length === 0 || activeCategories.includes(getPluginCategory(p))
    const matchesQuery = !query || p.id.includes(query.toLowerCase())
    return matchesPersona && matchesCategory && matchesQuery
  })
  const visibleArtifacts = artifacts.filter((artifact) => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return true
    }

    return artifact.title.toLowerCase().includes(normalizedQuery)
      || artifact.commandPath.toLowerCase().includes(normalizedQuery)
      || artifact.id.toLowerCase().includes(normalizedQuery)
  })

  return (
    <aside
      className={cn(
        "flex h-svh w-[var(--app-sidebar-w)] min-w-[var(--app-sidebar-w)] basis-[var(--app-sidebar-w)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className
      )}
      {...props}
    >
      <SidebarHeader className="relative gap-0 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Grainient
            className="absolute inset-0 [&>canvas]:pointer-events-none"
            timeSpeed={0.5}
            warpStrength={1.35}
            warpFrequency={6.1}
            warpSpeed={2.8}
            warpAmplitude={30}
            blendAngle={-30}
            blendSoftness={0.22}
            rotationAmount={420}
            noiseScale={4}
            grainAmount={0}
            grainScale={0}
            grainAnimated
            contrast={1.24}
            saturation={1.15}
            zoom={1.02}
            color1="#162323"
            color2="#1c2929"
            color3="#176953"
          />
        </div>

        <div className="relative z-10 flex h-(--row-h) items-center overflow-hidden px-4 text-lg font-semibold text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/20 via-black/10 to-transparent" />

          <span className="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">CGE Studio</span>
        </div>

        <div className="group/search-row relative z-10 flex h-(--row-h) items-center border-y border-white/20 bg-sidebar/68 px-2 backdrop-blur-md">
          <SidebarPhosphorIcon
            Icon={MagnifyingGlassIcon}
            className="size-3.5 text-sidebar-foreground/50 group-hover/search-row:[&>svg:first-child]:opacity-0 group-hover/search-row:[&>svg:last-child]:opacity-100 group-focus-within/search-row:[&>svg:first-child]:opacity-0 group-focus-within/search-row:[&>svg:last-child]:opacity-100"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={SEARCH_PLACEHOLDERS[activeSection]}
            className="min-w-0 flex-1 bg-transparent px-2 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none"
          />
          {!query.trim() && (
            <Kbd className="mr-1 hidden h-5 shrink-0 border border-white/15 bg-white/10 px-1.5 text-[10px] text-sidebar-foreground/70 md:inline-flex">
              Alt + S
            </Kbd>
          )}
          {activeSection === "chat" && (
            <Popover>
              <PopoverTrigger
                className={cn(
                  "group/filter-trigger flex h-full items-center gap-1 border-l border-sidebar-border px-2 text-xs transition-colors hover:text-sidebar-foreground",
                  activePersona ? "text-sidebar-foreground" : "text-sidebar-foreground/50"
                )}
              >
                <SidebarPhosphorIcon
                  Icon={FunnelIcon}
                  filled={Boolean(activePersona || activeCategories.length > 0)}
                  className="size-3.5 group-hover/filter-trigger:[&>svg:first-child]:opacity-0 group-hover/filter-trigger:[&>svg:last-child]:opacity-100"
                />
                <span>{filterLabel}</span>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverPositioner side="bottom" align="end" sideOffset={4}>
                  <PopoverContent className="w-52">
                    <ul>
                      <li className="border-b">
                        <button
                          onClick={() => {
                            setActivePersona(null)
                            setActiveCategories([])
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                            !activePersona && activeCategories.length === 0 && "font-medium"
                          )}
                        >
                          <span>All</span>
                          {!activePersona && activeCategories.length === 0 && <CheckIcon className="size-3.5" weight="bold" />}
                        </button>
                      </li>
                      <li className="border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                        Categories
                      </li>
                      {CATEGORIES.map((category) => {
                        const selected = activeCategories.includes(category.id)

                        return (
                          <li key={category.id} className="border-b last:border-0">
                            <button
                              onClick={() => toggleCategory(category.id)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                                selected && "font-medium"
                              )}
                            >
                              <span>{category.label}</span>
                              {selected && <CheckIcon className="size-3.5" weight="bold" />}
                            </button>
                          </li>
                        )
                      })}
                      <li className="border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                        Persona
                      </li>
                      {PERSONAS.map((p) => (
                        <li key={p.id} className="border-b last:border-0">
                          <button
                            onClick={() => setActivePersona(p.id)}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                              activePersona === p.id && "font-medium"
                            )}
                          >
                            <span>{p.label}</span>
                            {activePersona === p.id && <CheckIcon className="size-3.5" weight="bold" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </PopoverPositioner>
              </PopoverPortal>
            </Popover>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {activeSection === "chat" ? (
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {visible.map((plugin) => (
                  <PluginItem key={plugin.id} plugin={plugin} />
                ))}
                {visible.length === 0 && (
                  <li className="px-4 py-4 text-center text-xs text-sidebar-foreground/40">
                    No plugins match
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
                  <li className="px-4 py-4 text-center text-xs text-sidebar-foreground/40">
                    No artifacts match
                  </li>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="max-w-44">
              <p className="text-sm font-medium text-sidebar-foreground">
                {EMPTY_STATE_COPY[activeSection].title}
              </p>
              <p className="mt-2 text-xs leading-5 text-sidebar-foreground/55">
                {EMPTY_STATE_COPY[activeSection].description}
              </p>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-0">
        <button
          onClick={openConfig}
          className={cn(
            "group/config-item flex h-(--row-h) w-full items-center gap-2 border-t border-sidebar-border px-4 text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            configOpen ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"
          )}
        >
          <SidebarPhosphorIcon
            Icon={GearSixIcon}
            filled={configOpen}
            className="size-4 group-hover/config-item:[&>svg:first-child]:opacity-0 group-hover/config-item:[&>svg:last-child]:opacity-100"
          />
          <span>Configuration</span>
        </button>
      </SidebarFooter>
    </aside>
  )
}
