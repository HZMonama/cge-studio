# cge-studio — web app

The studio frontend. A Next.js App Router application that renders the full cge-studio UI and communicates with the runner over HTTP.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router), React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui, `@base-ui/react` |
| Icons | `@phosphor-icons/react` |
| State | Zustand |
| Editors | Monaco Editor, Tiptap (rich text / Markdown) |
| Animation | Motion |

## Running

From the repo root:

```bash
pnpm dev       # starts web + runner together
pnpm dev:web   # web only, on http://localhost:3000
```

Or from this directory:

```bash
pnpm dev
```

By default the app talks to the runner through a same-origin `/api/runner/*` proxy that forwards to `http://127.0.0.1:3333`. Start `pnpm dev:runner` from the repo root if you're running the services separately.

## Key files

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Main app shell — all top-level state, workspace management, section routing |
| `components/chat-surface.tsx` | Command composer and run event stream |
| `components/app-sidebar.tsx` | Navigation sidebar |
| `components/app-shell-header.tsx` | Top bar with workspace switcher |
| `components/workspace-footer.tsx` | Status bar and active run indicator |
| `lib/pipelines.ts` | Workflow/pipeline type definitions |
| `lib/plugins.ts` | Fallback plugin definitions for offline/runner-unavailable mode |

## Runner API client

All runner calls go through `lib/runner.ts` (or equivalent fetch calls in `app/page.tsx`). The frontend never accesses the filesystem or executes toolkit commands directly.

## Fallback plugin definitions

`lib/plugins.ts` carries static definitions for the highest-value commands so the composer can render inline forms even when the runner is offline. Runner-backed coverage is authoritative; fallback coverage is intentionally selective.

## Building

```bash
pnpm build
pnpm lint
pnpm typecheck
```
