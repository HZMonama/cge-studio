"use client"

import * as React from "react"
import { ClockCounterClockwiseIcon, LightningIcon } from "@phosphor-icons/react"

import { getPluginCategory, type Plugin } from "@/lib/plugins"
import { cn } from "@/lib/utils"

function commandScore(command: SlashCommand, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return -1

  const category = command.category.toLowerCase()
  const commandId = command.commandId.toLowerCase()
  const pluginId = command.pluginId.toLowerCase()
  const path = command.path.toLowerCase()

  if (commandId === normalizedQuery) return 100
  if (pluginId === normalizedQuery) return 95
  if (path === `/${normalizedQuery}`) return 92
  if (commandId.startsWith(normalizedQuery)) return 88
  if (pluginId.startsWith(normalizedQuery)) return 82
  if (category.startsWith(normalizedQuery)) return 74
  if (path.includes(`:${normalizedQuery}`)) return 68
  if (path.includes(normalizedQuery)) return 60
  if (category.includes(normalizedQuery)) return 52
  return -1
}

type SlashCommand = {
  category: string
  commandId: string
  description: string
  key: string
  output?: string
  path: string
  pluginId: string
  pluginLabel: string
}

export function ChatSurface({
  focusToken,
  onOpenHistory,
  onRun,
  runPending,
  plugins,
  prompt,
  setPrompt,
}: {
  focusToken: number
  onOpenHistory: () => void
  onRun: () => void
  runPending: boolean
  plugins: Plugin[]
  prompt: string
  setPrompt: React.Dispatch<React.SetStateAction<string>>
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [activeCommandIndex, setActiveCommandIndex] = React.useState(0)
  const slashCommands = React.useMemo<SlashCommand[]>(() => (
    plugins.flatMap(plugin => (
      plugin.commands.map(command => ({
        category: getPluginCategory(plugin),
        commandId: command.id,
        description: command.description,
        key: `${plugin.id}:${command.id}`,
        output: command.output,
        path: `/${plugin.id}:${command.id}`,
        pluginId: plugin.id,
        pluginLabel: plugin.label,
      }))
    ))
  ), [plugins])
  const trimmedPrompt = prompt.trimStart()
  const commandQuery = trimmedPrompt.startsWith("/") && !trimmedPrompt.includes(" ")
    ? trimmedPrompt.slice(1).toLowerCase()
    : ""
  const canRun = /^\/[a-z0-9-]+:[a-z0-9-]+/i.test(trimmedPrompt)

  const filteredCommands = commandQuery.length > 0
    ? slashCommands
      .map(command => ({
        command,
        score: commandScore(command, commandQuery),
      }))
      .filter(result => result.score >= 0)
      .sort((left, right) => right.score - left.score || left.command.path.localeCompare(right.command.path))
      .map(result => result.command)
      .slice(0, 8)
    : []

  React.useEffect(() => {
    setActiveCommandIndex(0)
  }, [commandQuery])

  React.useEffect(() => {
    inputRef.current?.focus()
    const pos = prompt.length
    inputRef.current?.setSelectionRange(pos, pos)
  }, [focusToken, prompt])

  function applyCommand(path: string) {
    setPrompt(`${path} `)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      const nextPos = path.length + 1
      inputRef.current?.setSelectionRange(nextPos, nextPos)
    })
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (commandQuery.length === 0 || filteredCommands.length === 0) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveCommandIndex(prev => (
        prev >= filteredCommands.length - 1 ? 0 : prev + 1
      ))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveCommandIndex(prev => (
        prev <= 0 ? filteredCommands.length - 1 : prev - 1
      ))
      return
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      applyCommand(filteredCommands[activeCommandIndex]?.path ?? filteredCommands[0].path)
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--editor-bg)]">
      <div className="flex justify-end px-6 pt-6">
        <button
          onClick={onOpenHistory}
          className="group flex h-9 items-center gap-2 border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <span className="relative flex size-3.5 shrink-0 items-center justify-center">
            <ClockCounterClockwiseIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
            <ClockCounterClockwiseIcon weight="fill" className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
          </span>
          History
        </button>
      </div>
      <div className="flex-1" />
      <div className="flex justify-center px-6 pb-2">
        <div className="w-full max-w-[80%]">
          <div className="border border-border/70 bg-background">
            <div className="flex items-center">
              <input
                ref={inputRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Type / to choose a command"
                className="h-11 w-full bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <button
                onClick={onRun}
                disabled={!canRun || runPending}
                className={cn(
                  "group flex h-11 shrink-0 items-center gap-2 border-l border-border/70 px-4 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60",
                  runPending && "bg-accent"
                )}
              >
                <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                  <LightningIcon className="size-3.5 transition-opacity group-hover:opacity-0 group-active:opacity-0" />
                  <LightningIcon weight="fill" className="absolute inset-0 size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
                </span>
                {runPending ? "Running" : "Run"}
              </button>
            </div>

            {commandQuery.length > 0 && (
              <div className="border-t border-border/70">
                {filteredCommands.length > 0 ? (
                  <ul>
                    {filteredCommands.map((command, index) => (
                      <li key={command.key} className="border-b border-border/60 last:border-b-0">
                        <button
                          onClick={() => applyCommand(command.path)}
                          onMouseEnter={() => setActiveCommandIndex(index)}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                            index === activeCommandIndex && "bg-accent"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground">{command.path}</span>
                              {command.output && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {command.output}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {command.description}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                            {command.pluginLabel}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-xs text-muted-foreground">
                    No commands match “{commandQuery}”.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
