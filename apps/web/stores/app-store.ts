"use client"

import { create } from "zustand"

export type AppSection = "runner" | "findings" | "program" | "metrics" | "artifacts"
export type AgentRuntime = "claude-code" | "codex"

const THEME_STORAGE_KEY = "cge.theme"
const SIDEBAR_STORAGE_KEY = "cge.sidebarOpen"
const ACTIVE_WORKSPACE_STORAGE_KEY = "cge.active-workspace-id"
const ACTIVE_SECTION_STORAGE_KEY = "cge.active-section"
const AGENT_RUNTIME_STORAGE_KEY = "cge.config.agentRuntime"
const VALID_SECTIONS: AppSection[] = ["runner", "findings", "program", "metrics", "artifacts"]

type Updater<T> = T | ((current: T) => T)

interface AppState {
  theme: "dark" | "light"
  mounted: boolean
  activeWorkspaceId: string | null
  activeSection: AppSection
  sidebarOpen: boolean
  agentRuntime: AgentRuntime
  hydrate: () => void
  setTheme: (theme: "dark" | "light") => void
  toggleTheme: () => void
  setActiveWorkspaceId: (value: Updater<string | null>) => void
  setActiveSection: (section: AppSection) => void
  setSidebarOpen: (value: Updater<boolean>) => void
  setAgentRuntime: (runtime: AgentRuntime) => void
}

function resolveNext<T>(value: Updater<T>, current: T): T {
  return typeof value === "function" ? (value as (current: T) => T)(current) : value
}

function applyTheme(theme: "dark" | "light") {
  const html = document.documentElement
  if (theme === "dark") {
    html.classList.add("dark")
  } else {
    html.classList.remove("dark")
  }
}

function getStoredTheme(): "dark" | "light" {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === "dark" || stored === "light") {
    return stored
  }
  if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light"
  }
  return "dark"
}

function getStoredAgentRuntime(): AgentRuntime {
  const stored = window.localStorage.getItem(AGENT_RUNTIME_STORAGE_KEY)
  return stored === "codex" || stored === "claude-code" ? stored : "claude-code"
}

export const useAppStore = create<AppState>()((set, get) => ({
  theme: "dark",
  mounted: false,
  activeWorkspaceId: null,
  activeSection: "runner",
  sidebarOpen: false,
  agentRuntime: "claude-code",
  hydrate: () => {
    if (typeof window === "undefined") {
      return
    }

    const theme = getStoredTheme()
    const activeWorkspaceId = window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
    const storedSection = window.localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY)
    const activeSection = VALID_SECTIONS.includes(storedSection as AppSection)
      ? (storedSection as AppSection)
      : "runner"
    const sidebarOpen = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
    const agentRuntime = getStoredAgentRuntime()

    applyTheme(theme)
    set({
      theme,
      mounted: true,
      activeWorkspaceId,
      activeSection,
      sidebarOpen,
      agentRuntime,
    })
  },
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
      applyTheme(theme)
    }
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark"
    get().setTheme(next)
  },
  setActiveWorkspaceId: (value) => {
    const next = resolveNext(value, get().activeWorkspaceId)
    if (typeof window !== "undefined") {
      if (next) {
        window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, next)
      } else {
        window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY)
      }
    }
    set({ activeWorkspaceId: next })
  },
  setActiveSection: (activeSection) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, activeSection)
    }
    set({ activeSection })
  },
  setSidebarOpen: (value) => {
    const next = resolveNext(value, get().sidebarOpen)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
    }
    set({ sidebarOpen: next })
  },
  setAgentRuntime: (agentRuntime) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AGENT_RUNTIME_STORAGE_KEY, agentRuntime)
    }
    set({ agentRuntime })
  },
}))

export function hydrateAppStore() {
  useAppStore.getState().hydrate()
}
