"use client"

import { create } from "zustand"

import { type Plugin } from "@/lib/plugins"

interface PluginPanelState {
  selectedPlugin: Plugin | null
  configOpen: boolean
  historyOpen: boolean
  metricHistoryOpen: boolean
  setSelectedPlugin: (plugin: Plugin | null) => void
  openConfig: () => void
  closeConfig: () => void
  toggleConfig: () => void
  openHistory: () => void
  closeHistory: () => void
  toggleHistory: () => void
  openMetricHistory: () => void
  closeMetricHistory: () => void
  toggleMetricHistory: () => void
}

export const usePluginPanel = create<PluginPanelState>()((set) => ({
  selectedPlugin: null,
  configOpen: false,
  historyOpen: false,
  metricHistoryOpen: false,
  setSelectedPlugin: (plugin) => set({ selectedPlugin: plugin, configOpen: false, historyOpen: false, metricHistoryOpen: false }),
  openConfig: () => set({ configOpen: true, selectedPlugin: null, historyOpen: false, metricHistoryOpen: false }),
  closeConfig: () => set({ configOpen: false }),
  toggleConfig: () => set((state) => ({ configOpen: !state.configOpen, selectedPlugin: null, historyOpen: false, metricHistoryOpen: false })),
  openHistory: () => set({ historyOpen: true, selectedPlugin: null, configOpen: false, metricHistoryOpen: false }),
  closeHistory: () => set({ historyOpen: false }),
  toggleHistory: () => set((state) => ({ historyOpen: !state.historyOpen, selectedPlugin: null, configOpen: false, metricHistoryOpen: false })),
  openMetricHistory: () => set({ metricHistoryOpen: true, selectedPlugin: null, configOpen: false, historyOpen: false }),
  closeMetricHistory: () => set({ metricHistoryOpen: false }),
  toggleMetricHistory: () => set((state) => ({ metricHistoryOpen: !state.metricHistoryOpen, selectedPlugin: null, configOpen: false, historyOpen: false })),
}))
