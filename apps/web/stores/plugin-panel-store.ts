"use client"

import { create } from "zustand"

import { type Plugin } from "@/lib/plugins"

interface PluginPanelState {
  selectedPlugin: Plugin | null
  configOpen: boolean
  setSelectedPlugin: (plugin: Plugin | null) => void
  openConfig: () => void
  closeConfig: () => void
}

export const usePluginPanel = create<PluginPanelState>()((set) => ({
  selectedPlugin: null,
  configOpen: false,
  setSelectedPlugin: (plugin) => set({ selectedPlugin: plugin, configOpen: false }),
  openConfig: () => set({ configOpen: true, selectedPlugin: null }),
  closeConfig: () => set({ configOpen: false }),
}))
