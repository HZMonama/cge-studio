# cge-ui

Open-source local-first UI scaffolding for `claude-grc-engineering`.

## Workspace

- `apps/web`: Next.js App Router frontend with `shadcn/ui`, `@base-ui/react`, and Zustand-backed local state.
- `apps/runner`: local HTTP runner for filesystem-aware endpoints and toolkit orchestration.
- `packages/types`: shared TypeScript contracts for runs, connectors, and framework data.
- `packages/toolkit-adapter`: starter filesystem and command helpers for the runner layer.

## Development

```bash
pnpm install
pnpm dev
```

The web app runs on `http://localhost:3000` and the runner listens on `http://127.0.0.1:3333`.
