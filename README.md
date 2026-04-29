# cge-studio

**cge-studio** is a local-first UI for the embedded `cli-grc-engineering` toolkit. It gives you an interactive studio for running evidence collection pipelines, gap assessments, and compliance reports without leaving your machine.

Everything runs locally: no cloud account required, no data leaves your filesystem.

## What it does

- **Workspace management** — create isolated workspaces that organize your findings, program data, and generated artifacts on disk under a `.cge/` directory.
- **Command composer** — discover every command the upstream toolkit exposes, fill in a rendered inline form, and execute it from the UI.
- **Workflow pipelines** — run multi-step GRC workflows (evidence-to-gap, IaC compliance, multi-cloud collection, executive reports) with interactive prompting.
- **Findings browser** — inspect raw and normalized evidence collected from AWS, GCP, GitHub, and Okta connectors.
- **Program dashboard** — track risks, controls, evidence, exceptions, tasks, and notes across your GRC program.
- **Artifact viewer** — read generated Markdown reports (exec summaries, board briefs, automation-coverage snapshots) inline.

## Distribution targets

- `cge-studio` UI + runner: Docker-first. The repo now ships a root `Dockerfile` and `docker-compose.yml` so the web app and runner can be started together behind a single `:3000` entrypoint.
- `cli-grc-engineering` toolkit: separate npm package. The vendored checkout under `cli/cli-grc-engineering` is prepared to be published independently from the UI.

## Architecture overview

```
cge-studio/
├── apps/
│   ├── web/          # Next.js frontend — the studio UI
│   └── runner/       # Node.js HTTP server — filesystem & toolkit bridge
├── cli/
│   └── cli-grc-engineering/  # embedded toolkit checkout
├── packages/
│   ├── types/        # shared TypeScript contracts
│   └── toolkit-adapter/  # filesystem & command helpers
└── scripts/          # dev/prod process orchestrators
```

The **runner** (`apps/runner`) is a plain Node.js HTTP server on port `3333`. It owns all filesystem access, command execution, workspace lifecycle, and workflow orchestration. The **web app** (`apps/web`) is a Next.js frontend on port `3000` that talks to the runner through a same-origin `/api/runner/*` proxy, so the Docker install story only needs port `3000`.

See [`apps/runner/README.md`](apps/runner/README.md) for a detailed breakdown of the runner architecture.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 or later |
| pnpm | 10.33.0 (enforced via `packageManager`) |
| Git | any recent version |

## Setup

### 1. Clone the repo

```bash
git clone <repo-url> cge-studio
cd cge-studio
```

### 2. Set up the embedded toolkit checkout

The runner expects the toolkit at `cli/cli-grc-engineering`. If it was not included in your clone:

```bash
git submodule add https://github.com/HZMonama/cli-grc-engineering.git cli/cli-grc-engineering
git submodule update --init --recursive
```

If you cloned with `--recurse-submodules`, this step is already done.

### 3. Install dependencies

```bash
pnpm install
```

The root `postinstall` hook also installs dependencies for the embedded `cli/cli-grc-engineering` package so runner-executed toolkit commands work without a second manual setup step.

### 4. (Optional) Override the toolkit path

If you want to point the runner at a different toolkit checkout, create a local config file:

```bash
cp apps/runner/runner.config.json.example apps/runner/runner.config.local.json
```

Then edit `runner.config.local.json` and set `toolkitPath` to your preferred path.

## Docker install

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24.0+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

### Quick start (Docker Compose — recommended)

The fastest way to get running is with the included `docker-compose.yml`. It builds the image, starts the web UI and runner together, and persists all data in a named volume.

```bash
# 1. Export your Anthropic API key
echo "ANTHROPIC_API_KEY=your-key" >> .env

# 2. Build and start
docker compose up --build -d

# 3. Open the studio
open http://localhost:3000
```

To stop:

```bash
docker compose down
```

To stop **and** delete the persistent volume (this removes all workspaces, cache, and config):

```bash
docker compose down -v
```

### Single-container flow

If you prefer running a single container directly:

```bash
# Build
docker build -t maynframe/cge-studio .

# Run (with API key)
docker run --rm \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your-key \
  -v cge-studio-data:/data \
  maynframe/cge-studio
```

### Required environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key (required by several toolkit commands). |

### Data persistence

Inside the container, all mutable data lives under `/data`:

| Path | Purpose |
|------|---------|
| `/data/config/claude-grc` | Runner configuration |
| `/data/cache/claude-grc` | Toolkit cache |
| `/data/app` | App-level metadata |
| `/data/workspaces` | Workspace registry and workspace data |

The compose stack automatically mounts a named volume (`cge-studio-data`) at `/data` so your work survives container restarts. When running a single container manually, add `-v cge-studio-data:/data` to achieve the same behavior.

## Running locally

```bash
pnpm dev
```

This starts both services in parallel:

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| Runner | http://127.0.0.1:3333 |

To start each service individually:

```bash
pnpm dev:web     # Next.js only
pnpm dev:runner  # runner only (with --watch)
pnpm start       # production-style web + runner
```

## Other scripts

```bash
pnpm build       # production build for web + syntax-check runner
pnpm lint        # lint web + check runner
pnpm typecheck   # type-check web + check runner
pnpm mcp         # start the CGE MCP server for Codex/agent clients
```

## CLI package

The embedded toolkit is kept separate from the UI package. Its package metadata lives in [`cli/cli-grc-engineering/package.json`](cli/cli-grc-engineering/package.json) and now exposes a `cli-grc-engineering` bin for npm-style installation or `npx` usage once published.

## Codex / MCP

`apps/mcp` exposes the embedded toolkit through FastMCP. Codex can connect to it as a local stdio MCP server and use generated tools for schema-backed commands plus runner controls for paused workflows.

See [`docs/CODEX.md`](docs/CODEX.md) for the Codex config snippet, tool list, and optional skill template.

## Runner Form Engine

The runner exposes a composable form engine that builds inline command forms from upstream toolkit docs plus local schema composition. Every toolkit command (`152 / 152` currently) resolves to a runner-backed form — even zero-field commands get a valid inline form state.

Resolution order for each command:

1. Parse baseline fields from the embedded toolkit markdown under `cli/cli-grc-engineering/plugins/**/commands/*.md`.
2. Apply a command-family preset from `apps/runner/forms/_presets` when one matches.
3. Compose reusable field groups from `apps/runner/forms/_groups`.
4. Apply command-specific overlays from `apps/runner/forms/**/<command>.json`.
5. Normalize and return the final schema through `GET /registry/plugins`.

See [`apps/runner/FORMS.md`](apps/runner/FORMS.md) for full authoring guidance.

## Workspaces on disk

Each workspace stores its data under a `.cge/` directory wherever you point it:

```
.cge/
├── workspace.json       # workspace manifest
├── findings/            # raw and normalized evidence
├── program/             # risks, controls, evidence, exceptions, tasks, notes
├── artifacts/           # generated and exported reports
├── dashboards/          # layout and snapshot data
└── runner/runs/         # command execution history
```

Workspace registry metadata is kept at `~/.local/share/cge-ui/workspaces/registry/`.
