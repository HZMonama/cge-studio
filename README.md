# cge-ui

Open-source local-first UI scaffolding for `claude-grc-engineering`.

## Workspace

- `apps/web`: Next.js App Router frontend with `shadcn/ui`, `@base-ui/react`, and Zustand-backed local state.
- `apps/runner`: local HTTP runner for filesystem-aware endpoints and toolkit orchestration.
- `cli/claude-grc-engineering`: upstream CLI checkout, intended to be mounted as a git submodule.
- `packages/types`: shared TypeScript contracts for runs, connectors, and framework data.
- `packages/toolkit-adapter`: starter filesystem and command helpers for the runner layer.

## Development

```bash
pnpm install
pnpm dev
```

The web app runs on `http://localhost:3000` and the runner listens on `http://127.0.0.1:3333`.

## CLI Setup

The preferred integration mode is an embedded upstream checkout at:

```text
cli/claude-grc-engineering
```

Recommended setup:

```bash
git submodule add https://github.com/ethanolivertroy/claude-grc-engineering.git cli/claude-grc-engineering
git submodule update --init --recursive
```

`apps/runner` will use that path by default. If needed, create `apps/runner/runner.config.local.json` from `apps/runner/runner.config.json.example` to override the toolkit path locally.
