"use client"

import * as React from "react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Selection } from "@tiptap/pm/state"
import DragHandle from "@tiptap/extension-drag-handle-react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  CodeIcon,
  CopyIcon,
  DotsSixVerticalIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  ParagraphIcon,
  PlusIcon,
  QuotesIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TrashIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover"

type EditorInstance = NonNullable<ReturnType<typeof useEditor>>
type BlockKind = "paragraph" | "heading-1" | "heading-2" | "bullet-list" | "ordered-list" | "blockquote" | "code-block"

type BlockInfo = {
  after: number
  focusPos: number
  label: string
  level?: number
  nodeType: string
  pos: number
}

type BlockOption = {
  description: string
  Icon: React.ElementType
  id: BlockKind
  label: string
}

const BLOCK_OPTIONS: BlockOption[] = [
  {
    id: "paragraph",
    label: "Text",
    description: "Start writing with plain text.",
    Icon: ParagraphIcon,
  },
  {
    id: "heading-1",
    label: "Heading 1",
    description: "Large section heading.",
    Icon: TextHOneIcon,
  },
  {
    id: "heading-2",
    label: "Heading 2",
    description: "Medium section heading.",
    Icon: TextHTwoIcon,
  },
  {
    id: "bullet-list",
    label: "Bulleted list",
    description: "Create a bulleted list.",
    Icon: ListBulletsIcon,
  },
  {
    id: "ordered-list",
    label: "Numbered list",
    description: "Create an ordered list.",
    Icon: ListNumbersIcon,
  },
  {
    id: "blockquote",
    label: "Quote",
    description: "Highlight quoted text.",
    Icon: QuotesIcon,
  },
  {
    id: "code-block",
    label: "Code block",
    description: "Insert a fenced code block.",
    Icon: CodeIcon,
  },
]

function clampPos(pos: number, max: number) {
  return Math.max(0, Math.min(pos, max))
}

function getBlockLabel(nodeType: string, level?: number) {
  if (nodeType === "paragraph") return "Text"
  if (nodeType === "heading" && level === 1) return "Heading 1"
  if (nodeType === "heading" && level === 2) return "Heading 2"
  if (nodeType === "heading") return `Heading ${level ?? ""}`.trim()
  if (nodeType === "bulletList") return "Bulleted list"
  if (nodeType === "orderedList") return "Numbered list"
  if (nodeType === "blockquote") return "Quote"
  if (nodeType === "codeBlock") return "Code block"
  return nodeType
}

function getBlockFocusPos(node: ProseMirrorNode, blockPos: number) {
  if (node.isTextblock) {
    return blockPos + 1
  }

  let nextFocusPos: number | null = null

  node.descendants((child, pos) => {
    if (child.isTextblock) {
      nextFocusPos = blockPos + pos + 1
      return false
    }

    return nextFocusPos == null
  })

  return nextFocusPos ?? blockPos + 1
}

function createBlockInfoFromNode(node: ProseMirrorNode, pos: number): BlockInfo {
  const level = typeof node.attrs.level === "number" ? node.attrs.level : undefined

  return {
    after: pos + node.nodeSize,
    focusPos: getBlockFocusPos(node, pos),
    label: getBlockLabel(node.type.name, level),
    level,
    nodeType: node.type.name,
    pos,
  }
}

function applySelection(editor: EditorInstance, pos: number) {
  const tr = editor.state.tr.setSelection(Selection.near(
    editor.state.doc.resolve(clampPos(pos, editor.state.doc.content.size)),
    1
  ))

  editor.view.dispatch(tr.scrollIntoView())
  editor.view.focus()
}

function createBlockNode(editor: EditorInstance, kind: BlockKind) {
  const { nodes } = editor.state.schema

  if (kind === "paragraph") return nodes.paragraph?.createAndFill()
  if (kind === "heading-1") return nodes.heading?.createAndFill({ level: 1 })
  if (kind === "heading-2") return nodes.heading?.createAndFill({ level: 2 })
  if (kind === "bullet-list") return nodes.bulletList?.createAndFill()
  if (kind === "ordered-list") return nodes.orderedList?.createAndFill()
  if (kind === "blockquote") return nodes.blockquote?.createAndFill()
  if (kind === "code-block") return nodes.codeBlock?.createAndFill()

  return null
}

function insertBlockBelow(editor: EditorInstance, block: BlockInfo, kind: BlockKind) {
  const node = createBlockNode(editor, kind)

  if (!node) {
    return
  }

  let tr = editor.state.tr.insert(block.after, node)
  tr = tr.setSelection(Selection.near(tr.doc.resolve(clampPos(getBlockFocusPos(node, block.after), tr.doc.content.size)), 1))
  editor.view.dispatch(tr.scrollIntoView())
  editor.view.focus()
}

function isMatchingBlockType(block: BlockInfo, kind: BlockKind) {
  if (kind === "paragraph") return block.nodeType === "paragraph"
  if (kind === "heading-1") return block.nodeType === "heading" && block.level === 1
  if (kind === "heading-2") return block.nodeType === "heading" && block.level === 2
  if (kind === "bullet-list") return block.nodeType === "bulletList"
  if (kind === "ordered-list") return block.nodeType === "orderedList"
  if (kind === "blockquote") return block.nodeType === "blockquote"
  if (kind === "code-block") return block.nodeType === "codeBlock"
  return false
}

function transformBlock(editor: EditorInstance, block: BlockInfo, kind: BlockKind) {
  if (isMatchingBlockType(block, kind)) {
    applySelection(editor, block.focusPos)
    return
  }

  const chain = editor.chain().focus(block.focusPos)

  if (kind === "paragraph") {
    chain.setParagraph().run()
    return
  }

  if (kind === "heading-1") {
    chain.setHeading({ level: 1 }).run()
    return
  }

  if (kind === "heading-2") {
    chain.setHeading({ level: 2 }).run()
    return
  }

  if (kind === "bullet-list") {
    chain.toggleBulletList().run()
    return
  }

  if (kind === "ordered-list") {
    chain.toggleOrderedList().run()
    return
  }

  if (kind === "blockquote") {
    chain.toggleBlockquote().run()
    return
  }

  if (kind === "code-block") {
    chain.toggleCodeBlock().run()
  }
}

function duplicateBlock(editor: EditorInstance, block: BlockInfo) {
  const node = editor.state.doc.nodeAt(block.pos)

  if (!node) {
    return
  }

  let tr = editor.state.tr.insert(block.after, node.copy(node.content))
  tr = tr.setSelection(Selection.near(tr.doc.resolve(clampPos(getBlockFocusPos(node, block.after), tr.doc.content.size)), 1))
  editor.view.dispatch(tr.scrollIntoView())
  editor.view.focus()
}

function deleteBlock(editor: EditorInstance, block: BlockInfo) {
  const { doc, schema } = editor.state
  const paragraph = schema.nodes.paragraph?.createAndFill()

  if (!paragraph) {
    return
  }

  let tr = editor.state.tr

  if (doc.childCount === 1) {
    tr = tr.replaceWith(block.pos, block.after, paragraph)
    tr = tr.setSelection(Selection.near(tr.doc.resolve(Math.min(block.pos + 1, tr.doc.content.size)), 1))
  } else {
    tr = tr.delete(block.pos, block.after)
    tr = tr.setSelection(Selection.near(tr.doc.resolve(clampPos(block.pos, tr.doc.content.size)), 1))
  }

  editor.view.dispatch(tr.scrollIntoView())
  editor.view.focus()
}

function BlockMenuItem({
  danger = false,
  description,
  Icon,
  label,
  onClick,
}: {
  danger?: boolean
  description: string
  Icon: React.ElementType
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent",
        danger && "text-destructive hover:bg-destructive/8"
      )}
    >
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border bg-background/80", danger && "border-destructive/20 bg-destructive/6")}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className={cn("block text-xs text-muted-foreground", danger && "text-destructive/70")}>{description}</span>
      </span>
    </button>
  )
}

function BlockControls({
  block,
  editor,
  onActionOpenChange,
  onInsertOpenChange,
}: {
  block: BlockInfo | null
  editor: EditorInstance
  onActionOpenChange: (open: boolean) => void
  onInsertOpenChange: (open: boolean) => void
}) {
  if (!block) {
    return <div className="pointer-events-none size-0" />
  }

  const handleControlMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    applySelection(editor, block.focusPos)
  }

  return (
    <div data-block-controls className="pointer-events-auto flex items-center gap-0.5">
      <Popover onOpenChange={onInsertOpenChange}>
        <PopoverTrigger
          onMouseDown={handleControlMouseDown}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`Insert a block below ${block.label}`}
        >
          <PlusIcon className="size-3.5" />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverPositioner side="right" align="start" sideOffset={10}>
            <PopoverContent className="w-72 rounded-3xl p-2">
              <div className="px-3 pb-2 pt-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Insert Below</p>
              </div>
              <div className="space-y-1">
                {BLOCK_OPTIONS.map((option) => (
                  <BlockMenuItem
                    key={option.id}
                    label={option.label}
                    description={option.description}
                    Icon={option.Icon}
                    onClick={() => {
                      insertBlockBelow(editor, block, option.id)
                      onInsertOpenChange(false)
                    }}
                  />
                ))}
              </div>
            </PopoverContent>
          </PopoverPositioner>
        </PopoverPortal>
      </Popover>

      <Popover onOpenChange={onActionOpenChange}>
        <PopoverTrigger
          onMouseDown={handleControlMouseDown}
          className="flex size-6 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
          aria-label={`Open actions for ${block.label}`}
        >
          <DotsSixVerticalIcon className="size-3.5" />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverPositioner side="right" align="start" sideOffset={10}>
            <PopoverContent className="w-80 rounded-3xl p-2">
              <div className="px-3 pb-2 pt-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Block Actions</p>
                <p className="mt-1 text-sm font-medium text-foreground">{block.label}</p>
              </div>

              <div className="space-y-1 border-b border-border/70 pb-2">
                {BLOCK_OPTIONS.map((option) => (
                  <BlockMenuItem
                    key={option.id}
                    label={`Turn into ${option.label}`}
                    description={option.description}
                    Icon={option.Icon}
                    onClick={() => {
                      transformBlock(editor, block, option.id)
                      onActionOpenChange(false)
                    }}
                  />
                ))}
              </div>

              <div className="space-y-1 pt-2">
                <BlockMenuItem
                  label="Duplicate block"
                  description="Create a copy directly below."
                  Icon={CopyIcon}
                  onClick={() => {
                    duplicateBlock(editor, block)
                    onActionOpenChange(false)
                  }}
                />
                <BlockMenuItem
                  danger
                  label="Delete block"
                  description="Remove this block from the document."
                  Icon={TrashIcon}
                  onClick={() => {
                    deleteBlock(editor, block)
                    onActionOpenChange(false)
                  }}
                />
              </div>
            </PopoverContent>
          </PopoverPositioner>
        </PopoverPortal>
      </Popover>
    </div>
  )
}

export function WorkspaceEditor() {
  const [block, setBlock] = React.useState<BlockInfo | null>(null)
  const [insertOpen, setInsertOpen] = React.useState(false)
  const [actionOpen, setActionOpen] = React.useState(false)
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "min-h-full w-full flex-1 px-14 py-10 text-sm focus:outline-none",
      },
    },
  })

  React.useEffect(() => {
    if (!editor) {
      return
    }

    if (insertOpen || actionOpen) {
      editor.commands.setMeta("lockDragHandle", true)
      return
    }

    editor.commands.setMeta("lockDragHandle", false)
  }, [editor, insertOpen, actionOpen])

  return (
    <div className="relative flex flex-1 overflow-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
      {editor && (
        <DragHandle
          editor={editor}
          onNodeChange={({ node, pos }) => {
            setBlock(node ? createBlockInfoFromNode(node, pos) : null)
          }}
        >
          <BlockControls
            block={block}
            editor={editor}
            onInsertOpenChange={setInsertOpen}
            onActionOpenChange={setActionOpen}
          />
        </DragHandle>
      )}

      <EditorContent
        editor={editor}
        className="flex min-h-full w-full flex-col [&_.tiptap]:flex-1 [&_.tiptap]:min-h-full [&_.tiptap]:pb-24 [&_.tiptap>_*]:pl-4 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground/40 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
      />
    </div>
  )
}
