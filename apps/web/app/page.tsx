"use client"

import { useState } from "react"
import { DownloadSimpleIcon, NotePencilIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { ConfigPanel } from "@/components/config-panel"
import { PluginPanel } from "@/components/plugin-panel"
import { WorkspaceEditor } from "@/components/workspace-editor"

interface Tab {
  id: string
  title: string
}

function newTab(): Tab {
  return { id: crypto.randomUUID(), title: "Untitled" }
}

export default function Page() {
  const [initialTab] = useState<Tab>(() => newTab())
  const [tabs, setTabs] = useState<Tab[]>(() => [initialTab])
  const [activeTab, setActiveTab] = useState<string>(initialTab.id)
  const activeWorkspace = tabs.find(tab => tab.id === activeTab) ?? tabs[0]

  function addTab() {
    const tab = newTab()
    setTabs(prev => [...prev, tab])
    setActiveTab(tab.id)
  }

  function closeTab(id: string) {
    setTabs(prev => {
      if (prev.length === 1) return prev
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      if (activeTab === id) setActiveTab(next[Math.max(0, idx - 1)].id)
      return next
    })
  }

  function renameActiveWorkspace() {
    const nextTitle = window.prompt("Rename workspace", activeWorkspace.title)
    const title = nextTitle?.trim()
    if (!title) return

    setTabs(prev => prev.map(tab => (
      tab.id === activeWorkspace.id ? { ...tab, title } : tab
    )))
  }

  return (
    <div className="flex min-h-svh bg-sidebar">
      <AppSidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <header className="sticky top-0 z-20 flex h-(--row-h) shrink-0 items-end bg-background/88 backdrop-blur">
          <div className="relative min-w-0 flex-1 self-stretch">
            <div
              className="flex h-full items-end gap-1 overflow-x-auto overflow-y-hidden px-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex h-[calc(var(--row-h)-6px)] min-w-0 max-w-44 shrink-0 items-center border border-b-0 px-3 text-xs transition-colors",
                    tab.id === activeTab
                      ? "z-10 -mb-px border-border/70 bg-(--editor-bg) text-foreground shadow-[0_2px_0_0_var(--editor-bg)]"
                      : "border-transparent bg-background/28 text-muted-foreground hover:border-border/45 hover:bg-background/52 hover:text-foreground"
                  )}
                >
                  <span className="truncate">{tab.title}</span>
                </button>
              ))}
            </div>

            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border/70" />
          </div>
        </header>

        {tabs.map(tab => (
          <div
            key={tab.id}
            className={cn("flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg)]", tab.id !== activeTab && "hidden")}
          >
            <WorkspaceEditor />
          </div>
        ))}

        <footer className="flex h-(--row-h) shrink-0 items-center border-t border-border/70 bg-background/90 px-2">
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={renameActiveWorkspace}
              className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <NotePencilIcon className="size-3.5" />
              Rename workspace
            </button>
            <button className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <DownloadSimpleIcon className="size-3.5" />
              Export workspace
            </button>
            <button
              onClick={() => closeTab(activeWorkspace.id)}
              disabled={tabs.length === 1}
              className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <TrashIcon className="size-3.5" />
              Delete workspace
            </button>
            <button
              onClick={addTab}
              className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <PlusIcon className="size-3.5" />
              Add workspace
            </button>
          </div>
        </footer>
      </main>

      <PluginPanel />
      <ConfigPanel />
    </div>
  )
}
