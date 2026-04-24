"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import type { Monaco } from "@monaco-editor/react"
import { Markdown } from "@tiptap/markdown"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { configureMonacoYaml } from "monaco-yaml"
import {
  BracketsCurlyIcon,
  EyeIcon,
  FileCodeIcon,
  InfoIcon,
  ListBulletsIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react"

import { type RunnerArtifactDetail } from "@/lib/runner"
import { cn } from "@/lib/utils"

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
        Loading source viewer…
      </div>
    ),
  },
)

type ArtifactPresentation =
  | "markdown"
  | "json"
  | "sarif"
  | "oscal"
  | "yaml"
  | "code"
  | "text"

type ArtifactTabId = "rendered" | "overview" | "structured" | "source"

type ArtifactTab = {
  id: ArtifactTabId
  label: string
  Icon: React.ElementType
}

const SOURCE_EDITOR_OPTIONS = {
  automaticLayout: true,
  contextmenu: false,
  fontLigatures: true,
  fontSize: 13,
  glyphMargin: false,
  lineNumbersMinChars: 3,
  minimap: { enabled: false },
  padding: { top: 16, bottom: 16 },
  readOnly: true,
  renderLineHighlight: "line" as const,
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
}

const STRUCTURED_EDITOR_OPTIONS = {
  ...SOURCE_EDITOR_OPTIONS,
  folding: true,
  lineNumbers: "on" as const,
}

const CODE_EXTENSIONS = new Set(["py", "rego", "sentinel", "tf", "sh", "bash"])

let yamlConfigured = false

function getFileExtension(pathname: string) {
  const normalized = pathname.split(/[?#]/u)[0] ?? pathname
  const lastSegment = normalized.split("/").pop() ?? normalized
  const dotIndex = lastSegment.lastIndexOf(".")

  if (dotIndex === -1) {
    return ""
  }

  return lastSegment.slice(dotIndex + 1).toLowerCase()
}

function getBaseName(pathname: string) {
  return (pathname.split("/").pop() ?? pathname).toLowerCase()
}

function getArtifactPresentation(artifact: RunnerArtifactDetail): ArtifactPresentation {
  const extension = getFileExtension(artifact.path)
  const baseName = getBaseName(artifact.path)

  if (baseName.endsWith(".sarif") || extension === "sarif") {
    return "sarif"
  }

  if (baseName.endsWith(".oscal-ar") || extension === "oscal-ar") {
    return "oscal"
  }

  if (artifact.format === "markdown" || extension === "md") {
    return "markdown"
  }

  if (artifact.format === "yaml" || extension === "yaml" || extension === "yml") {
    return "yaml"
  }

  if (artifact.kind === "code" || CODE_EXTENSIONS.has(extension)) {
    return "code"
  }

  if (artifact.format === "json" || extension === "json") {
    return "json"
  }

  return "text"
}

function getArtifactTabs(presentation: ArtifactPresentation): ArtifactTab[] {
  if (presentation === "markdown") {
    return [
      { id: "rendered", label: "Rendered", Icon: EyeIcon },
      { id: "source", label: "Source", Icon: FileCodeIcon },
    ]
  }

  if (presentation === "sarif" || presentation === "oscal") {
    return [
      { id: "overview", label: "Overview", Icon: ListBulletsIcon },
      { id: "structured", label: "Structured", Icon: TreeStructureIcon },
      { id: "source", label: "Raw", Icon: BracketsCurlyIcon },
    ]
  }

  if (presentation === "json") {
    return [{ id: "source", label: "Raw", Icon: BracketsCurlyIcon }]
  }

  return [{ id: "source", label: "Source", Icon: FileCodeIcon }]
}

function getDefaultTab(presentation: ArtifactPresentation): ArtifactTabId {
  if (presentation === "markdown") return "rendered"
  if (presentation === "sarif" || presentation === "oscal") return "overview"
  return "source"
}

function getSourceLanguage(artifact: RunnerArtifactDetail, presentation: ArtifactPresentation) {
  const extension = getFileExtension(artifact.path)

  if (presentation === "markdown") return "markdown"
  if (presentation === "json" || presentation === "sarif" || presentation === "oscal") return "json"
  if (presentation === "yaml") return "yaml"

  if (extension === "py") return "python"
  if (extension === "sh" || extension === "bash") return "shell"
  if (extension === "rego") return "rego"
  if (extension === "sentinel") return "sentinel"
  if (extension === "tf") return "terraform"

  return "plaintext"
}

function registerCustomMonacoLanguages(monaco: Monaco) {
  const known = new Set(
    monaco.languages.getLanguages().map((language: { id: string }) => language.id),
  )

  if (!known.has("rego")) {
    monaco.languages.register({ id: "rego" })
    monaco.languages.setMonarchTokensProvider("rego", {
      keywords: ["package", "import", "default", "else", "not", "some", "with", "as", "if", "contains", "in"],
      tokenizer: {
        root: [
          [/[a-zA-Z_][\w.]*/, {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          }],
          [/#.*$/, "comment"],
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"/, { token: "string.quote", next: "@string" }],
          [/[0-9]+(?:\.[0-9]+)?/, "number"],
          [/[{}\[\]()]/, "@brackets"],
          [/:=|==|!=|>=|<=|>|</, "operator"],
        ],
        string: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, { token: "string.quote", next: "@pop" }],
        ],
      },
    })
  }

  if (!known.has("terraform")) {
    monaco.languages.register({ id: "terraform" })
    monaco.languages.setMonarchTokensProvider("terraform", {
      keywords: ["resource", "data", "module", "variable", "output", "locals", "provider", "terraform", "true", "false", "null"],
      tokenizer: {
        root: [
          [/[a-zA-Z_][\w-]*/, {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          }],
          [/#.*$/, "comment"],
          [/\/\/.*$/, "comment"],
          [/"/, { token: "string.quote", next: "@string" }],
          [/[0-9]+(?:\.[0-9]+)?/, "number"],
          [/[{}\[\]()]/, "@brackets"],
          [/=|=>|:|,|\./, "delimiter"],
        ],
        string: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, { token: "string.quote", next: "@pop" }],
        ],
      },
    })
  }

  if (!known.has("sentinel")) {
    monaco.languages.register({ id: "sentinel" })
    monaco.languages.setMonarchTokensProvider("sentinel", {
      keywords: ["import", "param", "main", "rule", "if", "else", "true", "false"],
      tokenizer: {
        root: [
          [/[a-zA-Z_][\w-]*/, {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          }],
          [/#.*$/, "comment"],
          [/"/, { token: "string.quote", next: "@string" }],
          [/[0-9]+(?:\.[0-9]+)?/, "number"],
          [/[{}\[\]()]/, "@brackets"],
          [/=|==|!=|>=|<=|>|<|\.|,|:/, "operator"],
        ],
        string: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, { token: "string.quote", next: "@pop" }],
        ],
      },
    })
  }
}

function getCssVarHex(varName: string): string {
  if (typeof window === "undefined") return "#000000"

  const el = document.createElement("div")
  el.style.backgroundColor = `var(${varName})`
  el.style.display = "none"
  document.body.appendChild(el)
  const computed = getComputedStyle(el).backgroundColor
  document.body.removeChild(el)

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (match) {
    const [, red, green, blue, alpha] = match
    const alphaHex = alpha
      ? Math.round(Number(alpha) * 255).toString(16).padStart(2, "0")
      : ""

    return `#${Number(red).toString(16).padStart(2, "0")}${Number(green).toString(16).padStart(2, "0")}${Number(blue).toString(16).padStart(2, "0")}${alphaHex}`
  }

  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })

  if (!context) return "#000000"

  context.clearRect(0, 0, 1, 1)
  context.fillStyle = computed
  context.fillRect(0, 0, 1, 1)

  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
  const alphaHex = alpha < 255 ? alpha.toString(16).padStart(2, "0") : ""

  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}${alphaHex}`
}

function defineAppTheme(monaco: Monaco) {
  const root = document.documentElement
  const isDark = root.classList.contains("dark")
  const bg = getCssVarHex("--editor-bg")

  monaco.editor.defineTheme("app-dark", {
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": bg,
      "editorGutter.background": bg,
      "minimap.background": bg,
    },
  })
  monaco.editor.setTheme("app-dark")
}

function configureStructuredLanguageSupport(monaco: Monaco, artifact: RunnerArtifactDetail) {
  registerCustomMonacoLanguages(monaco)
  defineAppTheme(monaco)

  if (getArtifactPresentation(artifact) !== "yaml") {
    return
  }

  if (!yamlConfigured) {
    configureMonacoYaml(monaco, {
      completion: true,
      format: true,
      hover: true,
      validate: true,
      yamlVersion: "1.2",
    })
    yamlConfigured = true
  }
}

function safeJsonParse(content: string) {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return null
  }
}

function summarizeSarif(payload: unknown) {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { runs?: unknown[] }).runs)) {
    return null
  }

  const runs = (payload as { runs: Array<Record<string, unknown>> }).runs
  const levelCounts = new Map<string, number>()
  let resultCount = 0
  let ruleCount = 0

  for (const run of runs) {
    const results = Array.isArray(run.results) ? run.results : []
    const rules = Array.isArray((run.tool as { driver?: { rules?: unknown[] } } | undefined)?.driver?.rules)
      ? (run.tool as { driver?: { rules?: unknown[] } }).driver?.rules ?? []
      : []

    resultCount += results.length
    ruleCount += rules.length

    for (const result of results as Array<Record<string, unknown>>) {
      const level = typeof result.level === "string" ? result.level : "none"
      levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1)
    }
  }

  return {
    levelCounts: [...levelCounts.entries()].sort((left, right) => right[1] - left[1]),
    resultCount,
    ruleCount,
    runCount: runs.length,
    toolNames: runs
      .map((run) => (run.tool as { driver?: { name?: unknown } } | undefined)?.driver?.name)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  }
}

function summarizeOscal(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const record = payload as Record<string, unknown>
  const documentKey = Object.keys(record)[0] ?? "unknown"
  const document = record[documentKey]

  if (!document || typeof document !== "object") {
    return {
      documentKey,
      title: null,
      uuid: null,
    }
  }

  const metadata = (document as { metadata?: Record<string, unknown> }).metadata

  return {
    documentKey,
    title: typeof metadata?.title === "string" ? metadata.title : null,
    uuid: typeof (document as { uuid?: unknown }).uuid === "string" ? (document as { uuid: string }).uuid : null,
  }
}

function summarizeJson(payload: unknown) {
  if (Array.isArray(payload)) {
    return {
      entries: payload.length,
      kind: "array",
      topLevelKeys: [] as string[],
    }
  }

  if (payload && typeof payload === "object") {
    const keys = Object.keys(payload as Record<string, unknown>)
    return {
      entries: keys.length,
      kind: "object",
      topLevelKeys: keys.slice(0, 8),
    }
  }

  return {
    entries: 1,
    kind: typeof payload,
    topLevelKeys: [] as string[],
  }
}

function formatJsonValue(value: unknown) {
  if (value === null) return "null"
  if (typeof value === "string") return `"${value}"`
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === "object") return "Object"
  return String(value)
}

function JsonTreeNode({
  label,
  value,
  depth = 0,
}: {
  label?: string
  value: unknown
  depth?: number
}) {
  const isArray = Array.isArray(value)
  const isObject = value !== null && typeof value === "object" && !isArray

  if (!isArray && !isObject) {
    return (
      <div className="grid grid-cols-[minmax(0,220px)_1fr] gap-3 px-4 py-2 text-sm">
        <span className="truncate text-muted-foreground">{label ?? "value"}</span>
        <code className="break-words text-foreground">{formatJsonValue(value)}</code>
      </div>
    )
  }

  const entries = isArray
    ? (value as unknown[]).map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>)

  return (
    <details
      className=""
      open={depth < 2}
    >
      <summary className="grid cursor-pointer grid-cols-[minmax(0,220px)_1fr] items-center gap-3 px-4 py-2 text-sm text-foreground marker:hidden">
        <span className="truncate text-muted-foreground">
          {label ?? (isArray ? "array" : "object")}
        </span>
        <span className="min-w-0 text-xs text-muted-foreground">
          {isArray ? `${entries.length} items` : `${entries.length} keys`}
        </span>
      </summary>
      <div>
        {entries.map(([entryLabel, entryValue]) => (
          <JsonTreeNode
            key={`${label ?? "root"}-${entryLabel}`}
            label={entryLabel}
            value={entryValue}
            depth={depth + 1}
          />
        ))}
      </div>
    </details>
  )
}

function MetadataCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function MarkdownArtifactView({ content }: { content: string }) {
  const editor = useEditor(
    {
      content,
      contentType: "markdown",
      editable: false,
      editorProps: {
        attributes: {
          class: [
            "min-h-full px-8 py-6 text-sm leading-7 text-foreground focus:outline-none",
            "[&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold",
            "[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold",
            "[&_p]:my-3",
            "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
            "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
            "[&_li]:my-1",
            "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-background [&_pre]:p-4",
            "[&_code]:rounded [&_code]:bg-background/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
            "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
            "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
            "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
            "[&_th]:border-b [&_th]:border-border/70 [&_th]:px-3 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-muted-foreground",
            "[&_td]:border-b [&_td]:border-border/50 [&_td]:px-3 [&_td]:py-2 align-top",
          ].join(" "),
        },
      },
      extensions: [StarterKit, Markdown],
      immediatelyRender: false,
    },
    [],
  )

  useEffect(() => {
    if (!editor) return

    editor.commands.setContent(content, {
      contentType: "markdown",
    })
  }, [content, editor])

  if (!editor) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
        Loading markdown renderer…
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <EditorContent editor={editor} />
    </div>
  )
}

function SourceArtifactView({
  artifact,
  language,
}: {
  artifact: RunnerArtifactDetail
  language: string
}) {
  return (
    <div className="h-full min-h-0">
      <MonacoEditor
        beforeMount={(monaco) => configureStructuredLanguageSupport(monaco, artifact)}
        className="h-full"
        defaultLanguage={language}
        defaultPath={artifact.path}
        height="100%"
        language={language}
        loading="Loading source viewer…"
        options={language === "json" ? STRUCTURED_EDITOR_OPTIONS : SOURCE_EDITOR_OPTIONS}
        path={artifact.path}
        theme="app-dark"
        value={artifact.content}
      />
    </div>
  )
}

function StructuredArtifactView({
  parsed,
}: {
  parsed: unknown
}) {
  return (
    <div className="h-full overflow-auto">
      <JsonTreeNode value={parsed} />
    </div>
  )
}

function OverviewArtifactView({
  artifact,
  parsed,
  presentation,
}: {
  artifact: RunnerArtifactDetail
  parsed: unknown
  presentation: ArtifactPresentation
}) {
  if (presentation === "sarif") {
    const summary = summarizeSarif(parsed)

    if (!summary) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          This SARIF artifact could not be summarized. Use the raw tab to inspect the file.
        </div>
      )
    }

    return (
      <div className="h-full overflow-auto px-6 py-5">
        <div className="grid gap-3 md:grid-cols-4">
          <MetadataCard label="Runs" value={String(summary.runCount)} />
          <MetadataCard label="Results" value={String(summary.resultCount)} />
          <MetadataCard label="Rules" value={String(summary.ruleCount)} />
          <MetadataCard label="Tools" value={summary.toolNames.join(", ") || "Unknown"} />
        </div>
        <div className="mt-6 rounded-2xl border border-border/60 bg-background/80 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Severity Mix</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.levelCounts.map(([level, count]) => (
              <div
                key={level}
                className="rounded-xl border border-border/50 bg-background px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{level}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (presentation === "oscal") {
    const summary = summarizeOscal(parsed)

    if (!summary) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          This OSCAL artifact could not be summarized. Use the raw tab to inspect the file.
        </div>
      )
    }

    return (
      <div className="h-full overflow-auto px-6 py-5">
        <div className="grid gap-3 md:grid-cols-3">
          <MetadataCard label="Document Type" value={summary.documentKey} />
          <MetadataCard label="Title" value={summary.title ?? artifact.title} />
          <MetadataCard label="UUID" value={summary.uuid ?? "Not declared"} />
        </div>
      </div>
    )
  }

  const summary = summarizeJson(parsed)

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="grid gap-3 md:grid-cols-3">
        <MetadataCard label="Shape" value={summary.kind} />
        <MetadataCard label="Entries" value={String(summary.entries)} />
        <MetadataCard
          label="Top-level Keys"
          value={summary.topLevelKeys.length > 0 ? summary.topLevelKeys.join(", ") : "None"}
        />
      </div>
    </div>
  )
}

export function ArtifactsSurface({
  artifact,
  loading,
  error,
}: {
  artifact: RunnerArtifactDetail | null
  loading: boolean
  error?: string | null
}) {
  const presentation = artifact ? getArtifactPresentation(artifact) : null
  const tabs = useMemo(
    () => (presentation ? getArtifactTabs(presentation) : []),
    [presentation],
  )
  const parsedContent = useMemo(
    () => (artifact && (presentation === "json" || presentation === "sarif" || presentation === "oscal")
      ? safeJsonParse(artifact.content)
      : null),
    [artifact, presentation],
  )

  const [activeTab, setActiveTab] = useState<ArtifactTabId>("source")
  const [headerExpanded, setHeaderExpanded] = useState(false)

  useEffect(() => {
    if (!presentation) return
    setActiveTab(getDefaultTab(presentation))
  }, [artifact?.id, presentation])

  useEffect(() => {
    setHeaderExpanded(false)
  }, [artifact?.id])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-(--editor-bg) p-8">
        <p className="text-sm text-muted-foreground">Loading artifact…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-(--editor-bg) p-8">
        <div className="max-w-md text-center">
          <h2 className="text-sm font-medium text-rose-400">Failed to load artifact</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!artifact) {
    return (
      <div className="flex flex-1 items-center justify-center bg-(--editor-bg) p-8">
        <div className="max-w-md text-center">
          <h2 className="text-sm font-medium text-foreground">No artifact selected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select an artifact from the sidebar or Runner history to preview it here.
          </p>
        </div>
      </div>
    )
  }

  const language = getSourceLanguage(artifact, presentation ?? "text")
  const supportsStructured = parsedContent !== null

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-(--editor-bg)">
      <button
        className={cn(
          "group border-b border-border/70 bg-background px-6 text-left transition-[height,padding] duration-200",
          headerExpanded
            ? "py-4"
            : "h-(--row-h) min-h-(--row-h) max-h-(--row-h) overflow-hidden py-0",
        )}
        onClick={() => setHeaderExpanded((current) => !current)}
        type="button"
      >
        <div className={cn("flex gap-4", headerExpanded ? "items-start" : "h-full items-center")}>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative size-4 shrink-0">
                <InfoIcon className="absolute inset-0 size-4 text-muted-foreground transition-opacity duration-150 group-hover:opacity-0 group-active:opacity-0" />
                <InfoIcon className="absolute inset-0 size-4 text-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-100" weight="fill" />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{artifact.title}</p>
              <div className="flex shrink-0 items-center gap-3">
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(artifact.createdAt).toLocaleString()}
                </span>
                <span className="shrink-0 border border-border/60 bg-background px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {presentation}
                </span>
              </div>
            </div>
            {headerExpanded ? (
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p className="break-words">{artifact.commandPath}</p>
                <p className="break-words">{artifact.path}</p>
              </div>
            ) : null}
          </div>
        </div>
      </button>

      {tabs.length > 1 ? (
        <div className="border-b border-border/60 bg-background">
          <div className="flex gap-0 overflow-x-auto px-2">
            {tabs.map((tab) => {
              const disabled = (tab.id === "structured" || tab.id === "overview") && !supportsStructured

              return (
                <button
                  key={tab.id}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap",
                    activeTab === tab.id
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                    disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
                  )}
                  disabled={disabled}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.Icon className="size-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "rendered" ? (
          <MarkdownArtifactView content={artifact.content} />
        ) : null}

        {activeTab === "overview" && presentation && parsedContent !== null ? (
          <OverviewArtifactView
            artifact={artifact}
            parsed={parsedContent}
            presentation={presentation}
          />
        ) : null}

        {activeTab === "structured" ? (
          supportsStructured ? (
            <StructuredArtifactView parsed={parsedContent} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Structured inspection is not available for this artifact.
            </div>
          )
        ) : null}

        {activeTab === "source" ? (
          <SourceArtifactView artifact={artifact} language={language} />
        ) : null}
      </div>
    </div>
  )
}
