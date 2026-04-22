"use client"

import { create } from "zustand"

import { type Plugin } from "@/lib/plugins"

interface PluginPanelState {
  selectedPlugin: Plugin | null
  configOpen: boolean
  historyOpen: boolean
  setSelectedPlugin: (plugin: Plugin | null) => void
  openConfig: () => void
  closeConfig: () => void
  openHistory: () => void
  closeHistory: () => void
}

export const usePluginPanel = create<PluginPanelState>()((set) => ({
  selectedPlugin: null,
  configOpen: false,
  historyOpen: false,
  setSelectedPlugin: (plugin) => set({ selectedPlugin: plugin, configOpen: false, historyOpen: false }),
  openConfig: () => set({ configOpen: true, selectedPlugin: null, historyOpen: false }),
  closeConfig: () => set({ configOpen: false }),
  openHistory: () => set({ historyOpen: true, selectedPlugin: null, configOpen: false }),
  closeHistory: () => set({ historyOpen: false }),
}))
