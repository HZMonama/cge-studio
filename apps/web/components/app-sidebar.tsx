"use client"

import * as React from "react"
import {
  CloudIcon,
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
import { PLUGINS, type Persona, type Plugin } from "@/lib/plugins"
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

const PERSONAS: { id: Persona; label: string }[] = [
  { id: "engineer", label: "Engineer" },
  { id: "auditor",  label: "Auditor" },
  { id: "internal", label: "Internal" },
  { id: "tprm",     label: "TPRM" },
]

const BRAND_ICONS: Partial<Record<string, string>> = {
  "github-inspector": "/github_dark.svg",
  "okta-inspector":   "/okta_dark.png",
  "aws-inspector":    "/aws_dark.svg",
  "gcp-inspector":    "/google_cloud.svg",
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

export function AppSidebar(props: React.ComponentProps<"aside">) {
  const [query, setQuery] = React.useState("")
  const [activePersona, setActivePersona] = React.useState<Persona | null>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const { openConfig, configOpen } = usePluginPanel()

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return
      }

      if (event.key.toLowerCase() !== "s") {
        return
      }

      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const visible = PLUGINS.filter((p) => {
    const matchesPersona = !activePersona || p.personas.includes(activePersona)
    const matchesQuery = !query || p.id.includes(query.toLowerCase())
    return matchesPersona && matchesQuery
  })

  return (
    <aside
      className="flex h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
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
            placeholder="Search plugins..."
            className="min-w-0 flex-1 bg-transparent px-2 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none"
          />
          {!query.trim() && (
            <Kbd className="mr-1 hidden h-5 shrink-0 border border-white/15 bg-white/10 px-1.5 text-[10px] text-sidebar-foreground/70 md:inline-flex">
              Alt + S
            </Kbd>
          )}
          <Popover>
            <PopoverTrigger
              className={cn(
                "group/filter-trigger flex h-full items-center gap-1 border-l border-sidebar-border px-2 text-xs transition-colors hover:text-sidebar-foreground",
                activePersona ? "text-sidebar-foreground" : "text-sidebar-foreground/50"
              )}
            >
              <SidebarPhosphorIcon
                Icon={FunnelIcon}
                filled={Boolean(activePersona)}
                className="size-3.5 group-hover/filter-trigger:[&>svg:first-child]:opacity-0 group-hover/filter-trigger:[&>svg:last-child]:opacity-100"
              />
              <span>{activePersona ?? "All"}</span>
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverPositioner side="bottom" align="end" sideOffset={4}>
                <PopoverContent className="w-36">
                  <ul>
                    <li className="border-b">
                      <button
                        onClick={() => setActivePersona(null)}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                          !activePersona && "font-medium"
                        )}
                      >
                        All
                      </button>
                    </li>
                    {PERSONAS.map((p) => (
                      <li key={p.id} className="border-b last:border-0">
                        <button
                          onClick={() => setActivePersona(p.id)}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs transition-colors hover:bg-accent",
                            activePersona === p.id && "font-medium"
                          )}
                        >
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </PopoverPositioner>
            </PopoverPortal>
          </Popover>
        </div>
      </SidebarHeader>

      <SidebarContent>
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
