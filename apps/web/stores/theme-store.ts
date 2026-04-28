"use client"

import { create } from "zustand"

interface ThemeState {
  theme: "dark" | "light"
  mounted: boolean
  setTheme: (theme: "dark" | "light") => void
  toggleTheme: () => void
  setMounted: (mounted: boolean) => void
}

function getInitialTheme(): "dark" | "light" {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("cge.theme")
    if (stored === "dark" || stored === "light") {
      return stored
    }
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light"
    }
  }
  return "dark"
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: getInitialTheme(),
  mounted: false,
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cge.theme", theme)
      const html = document.documentElement
      if (theme === "dark") {
        html.classList.add("dark")
      } else {
        html.classList.remove("dark")
      }
    }
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark"
    get().setTheme(next)
  },
  setMounted: (mounted) => set({ mounted }),
}))
